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

            // 2. Obtener el carrito activo y sus ítems
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

            // 5. Insertar ítems de la orden y descontar stock
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

            // 6. Registrar en analíticas
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

            // 7. Limpiar carrito
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

    // Obtener todas las órdenes para el panel de administración
    public function getAllOrders() {
        $query = "SELECT 
                    o.id_orden,
                    o.id_usuario,
                    o.monto_total,
                    o.estado,
                    o.envio_calle,
                    o.envio_ciudad,
                    o.envio_estado,
                    o.envio_cp,
                    o.envio_pais,
                    o.creado_en,
                    u.nombre AS usuario_nombre,
                    u.email AS usuario_email,
                    u.telefono AS usuario_telefono,
                    u.calle AS usuario_calle,
                    u.ciudad AS usuario_ciudad,
                    u.estado_region AS usuario_estado,
                    u.codigo_postal AS usuario_cp,
                    u.pais AS usuario_pais
                  FROM ordenes o
                  LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario
                  ORDER BY o.id_orden DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $orders = array_map([$this, 'buildFullOrderObject'], $rows);

        http_response_code(200);
        echo json_encode($orders);
    }

    // Obtener el detalle completo de una sola orden por ID
    public function getOrderById($orderId) {
        $orderId = (int)$orderId;

        $query = "SELECT 
                    o.id_orden,
                    o.id_usuario,
                    o.monto_total,
                    o.estado,
                    o.envio_calle,
                    o.envio_ciudad,
                    o.envio_estado,
                    o.envio_cp,
                    o.envio_pais,
                    o.creado_en,
                    u.nombre AS usuario_nombre,
                    u.email AS usuario_email,
                    u.telefono AS usuario_telefono,
                    u.calle AS usuario_calle,
                    u.ciudad AS usuario_ciudad,
                    u.estado_region AS usuario_estado,
                    u.codigo_postal AS usuario_cp,
                    u.pais AS usuario_pais
                  FROM ordenes o
                  LEFT JOIN usuarios u ON o.id_usuario = u.id_usuario
                  WHERE o.id_orden = :oid
                  LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':oid', $orderId, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Orden no encontrada."]);
            return;
        }

        http_response_code(200);
        echo json_encode($this->buildFullOrderObject($row));
    }

    // Actualizar estado de la orden desde administración
    public function updateOrderStatus($orderId, $newStatus) {
        $orderId = (int)$orderId;
        $normalizedStatus = strtolower(trim($newStatus));

        $allowed = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!in_array($normalizedStatus, $allowed, true)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Estado no válido."]);
            return;
        }

        $stmt = $this->conn->prepare("UPDATE ordenes SET estado = :estado WHERE id_orden = :oid");
        $stmt->bindParam(':estado', $normalizedStatus);
        $stmt->bindParam(':oid', $orderId, PDO::PARAM_INT);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "Estado actualizado correctamente.",
                "newStatus" => ucfirst($normalizedStatus)
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo actualizar el estado."]);
        }
    }

    private function buildFullOrderObject($oRow) {
        $orderId = (int)$oRow['id_orden'];

        $itemsQuery = "SELECT 
                        oi.id_orden_item,
                        oi.id_producto,
                        oi.id_variante,
                        oi.cantidad,
                        oi.precio,
                        oi.atributos,
                        oi.imagen,
                        p.nombre AS producto_nombre,
                        p.imagenes_base,
                        pv.atributos AS variante_atributos
                       FROM ordenes_items oi
                       LEFT JOIN productos p ON oi.id_producto = p.id_producto
                       LEFT JOIN producto_variantes pv ON oi.id_variante = pv.id_variante
                       WHERE oi.id_orden = :oid
                       ORDER BY oi.id_orden_item ASC";

        $itemsStmt = $this->conn->prepare($itemsQuery);
        $itemsStmt->execute([':oid' => $orderId]);
        $itemRows = $itemsStmt->fetchAll();

        $subtotal = 0;
        $formattedItems = [];

        foreach ($itemRows as $iRow) {
            $attrs = json_decode($iRow['atributos'], true);
            if (!is_array($attrs) || empty($attrs)) {
                $attrs = json_decode($iRow['variante_atributos'] ?? '{}', true) ?: [];
            }

            $baseImgs = json_decode($iRow['imagenes_base'] ?? '[]', true) ?: [];
            $itemImage = !empty($iRow['imagen']) ? $iRow['imagen'] : ($baseImgs[0] ?? '');

            $unitPrice = (float)$iRow['precio'];
            $qty = (int)$iRow['cantidad'];
            $lineTotal = round($unitPrice * $qty, 2);
            $subtotal += $lineTotal;

            $formattedItems[] = [
                "itemId" => (int)$iRow['id_orden_item'],
                "productId" => (int)$iRow['id_producto'],
                "variantId" => $iRow['id_variante'] ? (int)$iRow['id_variante'] : null,
                "name" => $iRow['producto_nombre'] ?: 'Product #' . $iRow['id_producto'],
                "price" => $unitPrice,
                "quantity" => $qty,
                "lineTotal" => $lineTotal,
                "attributes" => empty($attrs) ? new stdClass() : $attrs,
                "image" => $itemImage
            ];
        }

        $subtotal = round($subtotal, 2);
        $total = round((float)$oRow['monto_total'], 2);
        $shipping = max(0, round($total - $subtotal, 2));

        $street = !empty($oRow['envio_calle']) ? $oRow['envio_calle'] : ($oRow['usuario_calle'] ?? '');
        $city = !empty($oRow['envio_ciudad']) ? $oRow['envio_ciudad'] : ($oRow['usuario_ciudad'] ?? '');
        $state = !empty($oRow['envio_estado']) ? $oRow['envio_estado'] : ($oRow['usuario_estado'] ?? '');
        $zipCode = !empty($oRow['envio_cp']) ? $oRow['envio_cp'] : ($oRow['usuario_cp'] ?? '');
        $country = !empty($oRow['envio_pais']) ? $oRow['envio_pais'] : ($oRow['usuario_pais'] ?? '');

        return [
            "orderId" => $orderId,
            "orderCode" => "ORD-" . str_pad((string)$orderId, 5, "0", STR_PAD_LEFT),
            "status" => ucfirst($oRow['estado']),
            "date" => $oRow['creado_en'],
            "user" => [
                "id" => $oRow['id_usuario'] ? (string)$oRow['id_usuario'] : null,
                "name" => $oRow['usuario_nombre'] ?: 'Guest Customer',
                "email" => $oRow['usuario_email'] ?: 'No email registered',
                "phone" => $oRow['usuario_telefono'] ?: 'Not provided'
            ],
            "shippingAddress" => [
                "street" => $street,
                "city" => $city,
                "state" => $state,
                "zipCode" => $zipCode,
                "country" => $country
            ],
            "totals" => [
                "subtotal" => $subtotal,
                "shipping" => $shipping,
                "total" => $total
            ],
            "items" => $formattedItems
        ];
    }
}
?>