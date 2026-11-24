<?php
class OrderController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function processCheckout($userId) {
        $userId = (int)$userId;

        try {
            $this->conn->beginTransaction();

            // 1. Obtener datos de envío del perfil del usuario
            $userStmt = $this->conn->prepare("SELECT calle, ciudad, estado_region, codigo_postal, pais FROM usuarios WHERE id_usuario = :uid LIMIT 1");
            $userStmt->bindParam(':uid', $userId, PDO::PARAM_INT);
            $userStmt->execute();
            $user = $userStmt->fetch();

            if (!$user) {
                $this->conn->rollBack();
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Usuario no encontrado."]);
                return;
            }

            // 2. Obtener el carrito activo y sus ítems con los precios y descuentos vigentes
            $cartQuery = "SELECT 
                            c.id_carrito,
                            ci.id_carrito_item,
                            ci.id_producto,
                            ci.id_variante,
                            ci.cantidad,
                            ci.atributos,
                            ci.imagen,
                            p.nombre,
                            p.precio_base,
                            GREATEST(
                                COALESCE(MAX(cat.porcentaje_descuento), 0),
                                COALESCE((SELECT porcentaje_descuento FROM categorias WHERE LOWER(nombre) = 'all' LIMIT 1), 0)
                            ) AS max_descuento
                          FROM carritos c
                          INNER JOIN carrito_items ci ON c.id_carrito = ci.id_carrito
                          INNER JOIN productos p ON ci.id_producto = p.id_producto
                          LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                          LEFT JOIN categorias cat ON pc.id_categoria = cat.id_categoria
                          WHERE c.id_usuario = :uid AND c.estado = 'active'
                          GROUP BY ci.id_carrito_item";

            $cartStmt = $this->conn->prepare($cartQuery);
            $cartStmt->bindParam(':uid', $userId, PDO::PARAM_INT);
            $cartStmt->execute();
            $items = $cartStmt->fetchAll();

            if (empty($items)) {
                $this->conn->rollBack();
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "El carrito está vacío."]);
                return;
            }

            $cartId = (int)$items[0]['id_carrito'];

            // 3. Validar stock y calcular el monto total
            $subtotal = 0;
            $preparedItems = [];

            foreach ($items as $item) {
                $prodId = (int)$item['id_producto'];
                $qty = (int)$item['cantidad'];

                // Verificar stock total disponible del producto
                $stockStmt = $this->conn->prepare("SELECT COALESCE(SUM(stock), 0) AS total_stock FROM producto_variantes WHERE id_producto = :pid FOR UPDATE");
                $stockStmt->bindParam(':pid', $prodId, PDO::PARAM_INT);
                $stockStmt->execute();
                $availableStock = (int)$stockStmt->fetch()['total_stock'];

                if ($availableStock < $qty) {
                    $this->conn->rollBack();
                    http_response_code(400);
                    echo json_encode([
                        "status" => "error",
                        "message" => "Stock insuficiente para: " . $item['nombre']
                    ]);
                    return;
                }

                $basePrice = (float)$item['precio_base'];
                $discount = (float)$item['max_descuento'];
                $unitPrice = $discount > 0 ? round($basePrice * (1 - ($discount / 100)), 2) : $basePrice;

                $subtotal += ($unitPrice * $qty);

                $preparedItems[] = [
                    'id_producto' => $prodId,
                    'id_variante' => (int)$item['id_variante'],
                    'cantidad' => $qty,
                    'precio' => $unitPrice,
                    'atributos' => $item['atributos'],
                    'imagen' => $item['imagen']
                ];
            }

            // Envío gratis a partir de $200, si no $15
            $shippingCost = $subtotal >= 200 ? 0 : 15;
            $montoTotal = round($subtotal + $shippingCost, 2);

            // 4. Crear la orden enlazada al usuario
            $orderQuery = "INSERT INTO ordenes 
                           (id_usuario, monto_total, estado, envio_calle, envio_ciudad, envio_estado, envio_cp, envio_pais) 
                           VALUES 
                           (:uid, :total, 'paid', :calle, :ciudad, :estado, :cp, :pais)";
            $orderStmt = $this->conn->prepare($orderQuery);
            $orderStmt->bindParam(':uid', $userId, PDO::PARAM_INT);
            $orderStmt->bindParam(':total', $montoTotal);
            $orderStmt->bindParam(':calle', $user['calle']);
            $orderStmt->bindParam(':ciudad', $user['ciudad']);
            $orderStmt->bindParam(':estado', $user['estado_region']);
            $orderStmt->bindParam(':cp', $user['codigo_postal']);
            $orderStmt->bindParam(':pais', $user['pais']);
            $orderStmt->execute();

            $orderId = (int)$this->conn->lastInsertId();

            // 5. Insertar ítems de la orden y descontar stock de producto_variantes
            $insertOrderItem = $this->conn->prepare("INSERT INTO ordenes_items 
                (id_orden, id_producto, id_variante, cantidad, precio, atributos, imagen) 
                VALUES (:oid, :pid, :vid, :qty, :price, :attrs, :img)");

            foreach ($preparedItems as $pItem) {
                $insertOrderItem->execute([
                    ':oid' => $orderId,
                    ':pid' => $pItem['id_producto'],
                    ':vid' => $pItem['id_variante'],
                    ':qty' => $pItem['cantidad'],
                    ':price' => $pItem['precio'],
                    ':attrs' => $pItem['atributos'],
                    ':img' => $pItem['imagen']
                ]);

                // Descontar stock y sumar vendidos en las variantes del producto
                $remainingToDeduct = $pItem['cantidad'];
                $varsStmt = $this->conn->prepare("SELECT id_variante, stock FROM producto_variantes WHERE id_producto = :pid AND stock > 0 ORDER BY id_variante ASC");
                $varsStmt->execute([':pid' => $pItem['id_producto']]);
                $variants = $varsStmt->fetchAll();

                foreach ($variants as $v) {
                    if ($remainingToDeduct <= 0) break;
                    $deduct = min((int)$v['stock'], $remainingToDeduct);

                    $updVar = $this->conn->prepare("UPDATE producto_variantes SET stock = stock - :deduct, vendidos = vendidos + :deduct WHERE id_variante = :vid");
                    $updVar->execute([
                        ':deduct' => $deduct,
                        ':vid' => (int)$v['id_variante']
                    ]);

                    $remainingToDeduct -= $deduct;
                }
            }

            // 6. Registrar la orden y ganancias en la tabla 'analiticas' (periodo actual MM-YYYY)
            $periodoActual = date('m-Y');
            $analyticsQuery = "INSERT INTO analiticas (periodo, ganancias_mes, ordenes_mes, historial_6m) 
                               VALUES (:periodo, :ganancias, 1, '[]') 
                               ON DUPLICATE KEY UPDATE 
                                 ganancias_mes = ganancias_mes + :ganancias, 
                                 ordenes_mes = ordenes_mes + 1";
            $analyticsStmt = $this->conn->prepare($analyticsQuery);
            $analyticsStmt->execute([
                ':periodo' => $periodoActual,
                ':ganancias' => $montoTotal
            ]);

            // 7. Limpiar carrito_items y marcar el carrito como convertido
            $delItems = $this->conn->prepare("DELETE FROM carrito_items WHERE id_carrito = :cid");
            $delItems->execute([':cid' => $cartId]);

            $updCart = $this->conn->prepare("UPDATE carritos SET estado = 'converted' WHERE id_carrito = :cid");
            $updCart->execute([':cid' => $cartId]);

            $this->conn->commit();

            http_response_code(201);
            echo json_encode([
                "status" => "success",
                "message" => "Pago agendado y orden creada correctamente.",
                "orderId" => $orderId
            ]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Error procesando el pago: " . $e->getMessage()
            ]);
        }
    }

    public function getOrdersByUser($userId) {
        $userId = (int)$userId;

        $ordersQuery = "SELECT id_orden, monto_total, estado, creado_en 
                        FROM ordenes 
                        WHERE id_usuario = :uid 
                        ORDER BY id_orden DESC";
        $stmt = $this->conn->prepare($ordersQuery);
        $stmt->bindParam(':uid', $userId, PDO::PARAM_INT);
        $stmt->execute();
        $ordersRows = $stmt->fetchAll();

        $orders = [];

        $itemsQuery = "SELECT 
                        oi.cantidad,
                        oi.precio,
                        oi.atributos,
                        oi.imagen,
                        p.nombre,
                        GROUP_CONCAT(DISTINCT c.nombre SEPARATOR ', ') AS categorias
                       FROM ordenes_items oi
                       INNER JOIN productos p ON oi.id_producto = p.id_producto
                       LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                       LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria AND LOWER(c.nombre) != 'all'
                       WHERE oi.id_orden = :oid
                       GROUP BY oi.id_orden_item";
        $itemsStmt = $this->conn->prepare($itemsQuery);

        foreach ($ordersRows as $oRow) {
            $orderId = (int)$oRow['id_orden'];
            $itemsStmt->execute([':oid' => $orderId]);
            $itemRows = $itemsStmt->fetchAll();

            $formattedItems = array_map(function($iRow) {
                $attrs = json_decode($iRow['atributos'], true) ?: [];
                $variantList = [];
                foreach ($attrs as $k => $v) {
                    if ($v) $variantList[] = "$k: $v";
                }
                $catText = $iRow['categorias'] ?: 'Product';
                if (!empty($variantList)) {
                    $catText .= ' • ' . implode(' • ', $variantList);
                }

                return [
                    "name" => $iRow['nombre'],
                    "category" => $catText,
                    "price" => (float)$iRow['precio'],
                    "quantity" => (int)$iRow['cantidad'],
                    "image" => $iRow['imagen']
                ];
            }, $itemRows);

            $orders[] = [
                "orderId" => $orderId,
                "status" => ucfirst($oRow['estado']),
                "date" => $oRow['creado_en'],
                "total" => (float)$oRow['monto_total'],
                "items" => $formattedItems
            ];
        }

        http_response_code(200);
        echo json_encode($orders);
    }
}
?>