<?php
class CartController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function addItem($data) {
        $userId = (int)$data['userId'];
        $productId = (int)$data['productId'];
        $requestedVariantId = isset($data['variantId']) ? (int)$data['variantId'] : 0;
        $quantity = max(1, (int)($data['quantity'] ?? 1));
        $image = trim($data['image'] ?? '');
        $attributes = is_array($data['attributes'] ?? null) ? $data['attributes'] : [];

        try {
            $this->conn->beginTransaction();

            // 1. Obtener o reactivar el carrito único del usuario
            $cartQuery = "INSERT INTO carritos (id_usuario, estado) 
                          VALUES (:userId, 'active') 
                          ON DUPLICATE KEY UPDATE 
                            estado = 'active', 
                            id_carrito = LAST_INSERT_ID(id_carrito)";
            $cartStmt = $this->conn->prepare($cartQuery);
            $cartStmt->bindParam(':userId', $userId, PDO::PARAM_INT);
            $cartStmt->execute();
            $cartId = (int)$this->conn->lastInsertId();

            // 2. Buscar la variante exacta en producto_variantes
            $variant = null;

            if ($requestedVariantId > 0) {
                $varStmt = $this->conn->prepare("SELECT id_variante, atributos, imagenes, stock, precio_delta 
                                                 FROM producto_variantes 
                                                 WHERE id_variante = :vid AND id_producto = :pid 
                                                 LIMIT 1");
                $varStmt->execute([
                    ':vid' => $requestedVariantId,
                    ':pid' => $productId
                ]);
                $variant = $varStmt->fetch();
            }

            // Respaldo: buscar por coincidencia exacta de atributos si no llegó variantId
            if (!$variant) {
                $allVarsStmt = $this->conn->prepare("SELECT id_variante, atributos, imagenes, stock, precio_delta 
                                                     FROM producto_variantes 
                                                     WHERE id_producto = :pid 
                                                     ORDER BY id_variante ASC");
                $allVarsStmt->execute([':pid' => $productId]);
                $allVars = $allVarsStmt->fetchAll();

                foreach ($allVars as $cand) {
                    $candAttrs = json_decode($cand['atributos'], true) ?: [];
                    if ($this->attributesMatch($candAttrs, $attributes)) {
                        $variant = $cand;
                        break;
                    }
                }

                // Si el producto no tiene atributos (variante única '{}'), tomar esa única variante
                if (!$variant && count($allVars) === 1 && empty($attributes)) {
                    $variant = $allVars[0];
                }
            }

            if (!$variant) {
                $this->conn->rollBack();
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "message" => "La variante seleccionada no existe."
                ]);
                return;
            }

            $variantId = (int)$variant['id_variante'];
            $maxStock = (int)$variant['stock'];

            // 3. Bloquear si la variante está agotada (stock <= 0)
            if ($maxStock <= 0) {
                $this->conn->rollBack();
                http_response_code(400);
                echo json_encode([
                    "status" => "error",
                    "message" => "Esta variante no está disponible (sin stock)."
                ]);
                return;
            }

            // 4. Calcular precio real desde MySQL (precio_base + precio_delta - descuento)
            $prodStmt = $this->conn->prepare("SELECT 
                                                p.precio_base,
                                                p.imagenes_base,
                                                GREATEST(
                                                    COALESCE(MAX(c.porcentaje_descuento), 0),
                                                    COALESCE((SELECT porcentaje_descuento FROM categorias WHERE LOWER(nombre) = 'all' LIMIT 1), 0)
                                                ) AS max_descuento
                                              FROM productos p
                                              LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                                              LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria
                                              WHERE p.id_producto = :pid
                                              GROUP BY p.id_producto
                                              LIMIT 1");
            $prodStmt->execute([':pid' => $productId]);
            $prodRow = $prodStmt->fetch();

            if (!$prodRow) {
                $this->conn->rollBack();
                http_response_code(404);
                echo json_encode(["status" => "error", "message" => "Producto no encontrado."]);
                return;
            }

            $basePrice = (float)$prodRow['precio_base'] + (float)($variant['precio_delta'] ?? 0);
            $discount = (float)$prodRow['max_descuento'];
            $unitPrice = $discount > 0 ? round($basePrice * (1 - ($discount / 100)), 2) : round($basePrice, 2);

            if ($image === '') {
                $varImgs = json_decode($variant['imagenes'] ?? '[]', true) ?: [];
                $baseImgs = json_decode($prodRow['imagenes_base'] ?? '[]', true) ?: [];
                $image = $varImgs[0] ?? ($baseImgs[0] ?? '');
            }

            $dbAttrs = json_decode($variant['atributos'], true);
            $finalAttrs = (is_array($dbAttrs) && !empty($dbAttrs)) ? $dbAttrs : $attributes;
            $attributesJson = json_encode(empty($finalAttrs) ? new stdClass() : $finalAttrs, JSON_UNESCAPED_UNICODE);

            // 5. Verificar si esta misma variante ya está en el carrito del usuario
            $checkItem = "SELECT id_carrito_item, cantidad 
                          FROM carrito_items 
                          WHERE id_carrito = :cartId 
                            AND id_producto = :productId 
                            AND id_variante = :variantId 
                          LIMIT 1";
            $itemStmt = $this->conn->prepare($checkItem);
            $itemStmt->execute([
                ':cartId' => $cartId,
                ':productId' => $productId,
                ':variantId' => $variantId
            ]);
            $existingItem = $itemStmt->fetch();

            if ($existingItem) {
                $currentQty = (int)$existingItem['cantidad'];
                if ($currentQty >= $maxStock) {
                    $this->conn->rollBack();
                    http_response_code(400);
                    echo json_encode([
                        "status" => "error",
                        "message" => "Ya alcanzaste el stock máximo disponible ($maxStock) para esta variante."
                    ]);
                    return;
                }

                $newQty = min($currentQty + $quantity, $maxStock);
                $updateStmt = $this->conn->prepare("UPDATE carrito_items 
                                                    SET cantidad = :qty, precio = :price, atributos = :attrs, imagen = :img 
                                                    WHERE id_carrito_item = :itemId");
                $updateStmt->execute([
                    ':qty' => $newQty,
                    ':price' => $unitPrice,
                    ':attrs' => $attributesJson,
                    ':img' => $image,
                    ':itemId' => (int)$existingItem['id_carrito_item']
                ]);
            } else {
                $finalQty = min($quantity, $maxStock);
                $insertStmt = $this->conn->prepare("INSERT INTO carrito_items 
                    (id_carrito, id_producto, id_variante, cantidad, atributos, precio, imagen) 
                    VALUES 
                    (:cartId, :productId, :variantId, :qty, :atributos, :price, :imagen)");
                $insertStmt->execute([
                    ':cartId' => $cartId,
                    ':productId' => $productId,
                    ':variantId' => $variantId,
                    ':qty' => $finalQty,
                    ':atributos' => $attributesJson,
                    ':price' => $unitPrice,
                    ':imagen' => $image
                ]);
            }

            // 6. Obtener total de unidades en el carrito
            $countStmt = $this->conn->prepare("SELECT COALESCE(SUM(cantidad), 0) AS total_items FROM carrito_items WHERE id_carrito = :cartId");
            $countStmt->execute([':cartId' => $cartId]);
            $totalItems = (int)$countStmt->fetch()['total_items'];

            $this->conn->commit();

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "Producto agregado al carrito.",
                "cartCount" => $totalItems
            ]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al agregar al carrito: " . $e->getMessage()]);
        }
    }

public function getCartByUser($userId) {
        $query = "SELECT 
                    ci.id_carrito_item AS itemId,
                    ci.id_producto AS id,
                    ci.id_variante AS variantId,
                    p.nombre AS name,
                    (p.precio_base + COALESCE(pv.precio_delta, 0)) AS original_price,
                    ci.imagen AS image,
                    ci.cantidad AS quantity,
                    ci.atributos AS attributes,
                    COALESCE(pv.stock, 0) AS stock,
                    GREATEST(
                        COALESCE(MAX(cat.porcentaje_descuento), 0),
                        COALESCE((SELECT porcentaje_descuento FROM categorias WHERE LOWER(nombre) = 'all' LIMIT 1), 0)
                    ) AS max_descuento
                  FROM carritos c
                  INNER JOIN carrito_items ci ON c.id_carrito = ci.id_carrito
                  INNER JOIN productos p ON ci.id_producto = p.id_producto
                  LEFT JOIN producto_variantes pv ON ci.id_variante = pv.id_variante
                  LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                  LEFT JOIN categorias cat ON pc.id_categoria = cat.id_categoria
                  WHERE c.id_usuario = :userId AND c.estado = 'active'
                  GROUP BY ci.id_carrito_item
                  ORDER BY ci.id_carrito_item DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $items = array_map(function($row) {
            $attrs = json_decode($row['attributes'], true) ?: [];
            $originalPrice = (float)$row['original_price'];
            $discount = (float)$row['max_descuento'];
            $finalPrice = $discount > 0
                ? round($originalPrice * (1 - ($discount / 100)), 2)
                : $originalPrice;

            return [
                "itemId" => (int)$row['itemId'],
                "id" => (string)$row['id'],
                "variantId" => (int)$row['variantId'],
                "name" => $row['name'],
                "price" => $finalPrice,
                "originalPrice" => $originalPrice,
                "discount" => $discount,
                "image" => $row['image'],
                "quantity" => (int)$row['quantity'],
                "stock" => (int)$row['stock'],
                "attributes" => empty($attrs) ? new stdClass() : $attrs,
                "selectedSize" => $attrs['Size'] ?? ($attrs['Talla'] ?? null),
                "selectedColor" => $attrs['Color'] ?? null,
                "selectedMaterial" => $attrs['Material'] ?? null
            ];
        }, $rows);

        http_response_code(200);
        echo json_encode($items);
    }

    public function updateQuantity($itemId, $quantity) {
        $itemId = (int)$itemId;
        $quantity = (int)$quantity;

        if ($quantity <= 0) {
            $this->removeItem($itemId);
            return;
        }

        // Consultar stock exacto de la variante asociada a este ítem
        $stockQuery = "SELECT COALESCE(pv.stock, 0) AS max_stock
                       FROM carrito_items ci
                       LEFT JOIN producto_variantes pv ON ci.id_variante = pv.id_variante
                       WHERE ci.id_carrito_item = :itemId
                       LIMIT 1";
        $stockStmt = $this->conn->prepare($stockQuery);
        $stockStmt->bindParam(':itemId', $itemId, PDO::PARAM_INT);
        $stockStmt->execute();
        $row = $stockStmt->fetch();
        $maxStock = $row ? (int)$row['max_stock'] : 0;

        if ($maxStock <= 0) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Esta variante ya no tiene stock disponible."]);
            return;
        }

        $finalQty = min($quantity, $maxStock);

        $stmt = $this->conn->prepare("UPDATE carrito_items SET cantidad = :qty WHERE id_carrito_item = :itemId");
        $stmt->bindParam(':qty', $finalQty, PDO::PARAM_INT);
        $stmt->bindParam(':itemId', $itemId, PDO::PARAM_INT);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(["status" => "success", "quantity" => $finalQty]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo actualizar la cantidad."]);
        }
    }

    public function removeItem($itemId) {
        $itemId = (int)$itemId;
        $stmt = $this->conn->prepare("DELETE FROM carrito_items WHERE id_carrito_item = :itemId");
        $stmt->bindParam(':itemId', $itemId, PDO::PARAM_INT);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Ítem eliminado del carrito."]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo eliminar el ítem."]);
        }
    }

    private function attributesMatch(array $a, array $b): bool {
        if (count($a) !== count($b)) return false;
        foreach ($a as $k => $v) {
            if (!array_key_exists($k, $b)) return false;
            if (mb_strtolower(trim((string)$v)) !== mb_strtolower(trim((string)$b[$k]))) {
                return false;
            }
        }
        return true;
    }
}
?>