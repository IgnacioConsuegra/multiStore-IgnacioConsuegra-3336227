<?php
class CartController {
    private $conn;

    public function __construct($db) {
        $this->conn =$db;
    }

    public function addItem($data) {
        $userId = (int)$data['userId'];
        $productId = (int)$data['productId'];
        $quantity = max(1, (int)$data['quantity']);
        $price = (float)$data['price'];
        $image =$data['image'] ?? '';
        $attributes =$data['attributes'] ?? [];

        try {
            $this->conn->beginTransaction();

            $cartQuery = "INSERT INTO carritos (id_usuario, estado) 
                          VALUES (:userId, 'active') 
                          ON DUPLICATE KEY UPDATE 
                            estado = 'active', 
                            id_carrito = LAST_INSERT_ID(id_carrito)";
            $cartStmt =$this->conn->prepare($cartQuery);$cartStmt->bindParam(':userId', $userId, PDO::PARAM_INT);$cartStmt->execute();
            $cartId = (int)$this->conn->lastInsertId();

            $varQuery = "SELECT id_variante, stock FROM producto_variantes WHERE id_producto = :productId ORDER BY id_variante ASC LIMIT 1";
            $varStmt =$this->conn->prepare($varQuery);$varStmt->bindParam(':productId', $productId, PDO::PARAM_INT);$varStmt->execute();
            $variant =$varStmt->fetch();

            if (!$variant) {
                $createVar =$this->conn->prepare("INSERT INTO producto_variantes (id_producto, atributos, stock) VALUES (:pid, '{}', 10)");
                $createVar->bindParam(':pid',$productId, PDO::PARAM_INT);
                $createVar->execute();$variantId = (int)$this->conn->lastInsertId();$maxStock = 10;
            } else {
                $variantId = (int)$variant['id_variante'];
                $stockStmt =$this->conn->prepare("SELECT COALESCE(SUM(stock), 0) AS total_stock FROM producto_variantes WHERE id_producto = :pid");
                $stockStmt->bindParam(':pid', $productId, PDO::PARAM_INT);$stockStmt->execute();
                $maxStock = (int)$stockStmt->fetch()['total_stock'];
            }

            if ($maxStock <= 0) {$this->conn->rollBack();
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Producto sin stock disponible."]);
                return;
            }

            $attributesJson = json_encode($attributes, JSON_UNESCAPED_UNICODE);

            $checkItem = "SELECT id_carrito_item, cantidad 
                          FROM carrito_items 
                          WHERE id_carrito = :cartId 
                            AND id_producto = :productId 
                            AND atributos = :atributos 
                          LIMIT 1";
            $itemStmt =$this->conn->prepare($checkItem);$itemStmt->bindParam(':cartId', $cartId, PDO::PARAM_INT);$itemStmt->bindParam(':productId', $productId, PDO::PARAM_INT);$itemStmt->bindParam(':atributos', $attributesJson);$itemStmt->execute();
            $existingItem =$itemStmt->fetch();

            if ($existingItem) {
                $newQty = min($existingItem['cantidad'] + $quantity,$maxStock);
                $updateStmt =$this->conn->prepare("UPDATE carrito_items SET cantidad = :qty, precio = :price WHERE id_carrito_item = :itemId");
                $updateStmt->bindParam(':qty', $newQty, PDO::PARAM_INT);$updateStmt->bindParam(':price', $price);$updateStmt->bindParam(':itemId', $existingItem['id_carrito_item'], PDO::PARAM_INT);$updateStmt->execute();
            } else {
                $finalQty = min($quantity,$maxStock);
                $insertStmt =$this->conn->prepare("INSERT INTO carrito_items 
                    (id_carrito, id_producto, id_variante, cantidad, atributos, precio, imagen) 
                    VALUES 
                    (:cartId, :productId, :variantId, :qty, :atributos, :price, :imagen)");
                $insertStmt->bindParam(':cartId', $cartId, PDO::PARAM_INT);$insertStmt->bindParam(':productId', $productId, PDO::PARAM_INT);$insertStmt->bindParam(':variantId', $variantId, PDO::PARAM_INT);$insertStmt->bindParam(':qty', $finalQty, PDO::PARAM_INT);$insertStmt->bindParam(':atributos', $attributesJson);$insertStmt->bindParam(':price', $price);$insertStmt->bindParam(':imagen', $image);$insertStmt->execute();
            }

            $countStmt =$this->conn->prepare("SELECT COALESCE(SUM(cantidad), 0) AS total_items FROM carrito_items WHERE id_carrito = :cartId");
            $countStmt->bindParam(':cartId', $cartId, PDO::PARAM_INT);$countStmt->execute();
            $totalItems = (int)$countStmt->fetch()['total_items'];

            $this->conn->commit();

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "message" => "Producto agregado al carrito.",
                "cartCount" => $totalItems
            ]);

        } catch (Exception $e) {$this->conn->rollBack();
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error: " . $e->getMessage()]);
        }
    }

  public function getCartByUser($userId) {
        $query = "SELECT 
                    ci.id_carrito_item AS itemId,
                    ci.id_producto AS id,
                    p.nombre AS name,
                    p.precio_base AS original_price,
                    ci.imagen AS image,
                    ci.cantidad AS quantity,
                    ci.atributos AS attributes,
                    GREATEST(
                        COALESCE(MAX(cat.porcentaje_descuento), 0),
                        COALESCE((SELECT porcentaje_descuento FROM categorias WHERE LOWER(nombre) = 'all' LIMIT 1), 0)
                    ) AS max_descuento,
                    COALESCE((SELECT SUM(stock) FROM producto_variantes WHERE id_producto = ci.id_producto), 0) AS stock
                  FROM carritos c
                  INNER JOIN carrito_items ci ON c.id_carrito = ci.id_carrito
                  INNER JOIN productos p ON ci.id_producto = p.id_producto
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
            $finalPrice = $discount > 0 ? round($originalPrice * (1 - ($discount / 100)), 2) : $originalPrice;

            return [
                "itemId" => (int)$row['itemId'],
                "id" => (string)$row['id'],
                "name" => $row['name'],
                "price" => $finalPrice,
                "originalPrice" => $originalPrice,
                "discount" => $discount,
                "image" => $row['image'],
                "quantity" => (int)$row['quantity'],
                "stock" => (int)$row['stock'],
                "selectedSize" => $attrs['Size'] ?? null,
                "selectedColor" => $attrs['Color'] ?? null,
                "selectedMaterial" => $attrs['Material'] ?? null
            ];
        }, $rows);

        http_response_code(200);
        echo json_encode($items);
    }

    public function updateQuantity($itemId,$quantity) {
        $itemId = (int)$itemId;
        $quantity = (int)$quantity;

        if ($quantity <= 0) {
            $this->removeItem($itemId);
            return;
        }

        // Consultar stock máximo del producto asociado a este ítem
        $stockQuery = "SELECT COALESCE(SUM(pv.stock), 0) AS max_stock
                       FROM carrito_items ci
                       INNER JOIN producto_variantes pv ON ci.id_producto = pv.id_producto
                       WHERE ci.id_carrito_item = :itemId";
        $stockStmt =$this->conn->prepare($stockQuery);$stockStmt->bindParam(':itemId', $itemId, PDO::PARAM_INT);$stockStmt->execute();
        $maxStock = (int)$stockStmt->fetch()['max_stock'];

        $finalQty = $maxStock > 0 ? min($quantity, $maxStock) :$quantity;

        $stmt =$this->conn->prepare("UPDATE carrito_items SET cantidad = :qty WHERE id_carrito_item = :itemId");
        $stmt->bindParam(':qty',$finalQty, PDO::PARAM_INT);
        $stmt->bindParam(':itemId',$itemId, PDO::PARAM_INT);

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
        $stmt =$this->conn->prepare("DELETE FROM carrito_items WHERE id_carrito_item = :itemId");
        $stmt->bindParam(':itemId',$itemId, PDO::PARAM_INT);

        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Ítem eliminado del carrito."]);
        } else {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo eliminar el ítem."]);
        }
    }
}
?>