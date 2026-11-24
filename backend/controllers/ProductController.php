<?php
class ProductController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        $query = "SELECT 
                    p.id_producto, 
                    p.nombre, 
                    p.descripcion, 
                    p.precio_base, 
                    p.imagenes_base, 
                    p.destacado, 
                    p.opciones,
                    GROUP_CONCAT(DISTINCT c.nombre SEPARATOR ',') AS categorias,
                    GREATEST(
                        COALESCE(MAX(c.porcentaje_descuento), 0),
                        COALESCE((SELECT porcentaje_descuento FROM categorias WHERE LOWER(nombre) = 'all' LIMIT 1), 0)
                    ) AS max_descuento,
                    COALESCE((SELECT SUM(stock) FROM producto_variantes WHERE id_producto = p.id_producto), 0) AS stock_total
                  FROM productos p
                  LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                  LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria
                  GROUP BY p.id_producto
                  ORDER BY p.id_producto ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $products = array_map([$this, 'formatProduct'], $rows);

        http_response_code(200);
        echo json_encode($products);
    }

    public function getById($id) {
        $query = "SELECT 
                    p.id_producto, 
                    p.nombre, 
                    p.descripcion, 
                    p.precio_base, 
                    p.imagenes_base, 
                    p.destacado, 
                    p.opciones,
                    GROUP_CONCAT(DISTINCT c.nombre SEPARATOR ',') AS categorias,
                    GREATEST(
                        COALESCE(MAX(c.porcentaje_descuento), 0),
                        COALESCE((SELECT porcentaje_descuento FROM categorias WHERE LOWER(nombre) = 'all' LIMIT 1), 0)
                    ) AS max_descuento,
                    COALESCE((SELECT SUM(stock) FROM producto_variantes WHERE id_producto = p.id_producto), 0) AS stock_total
                  FROM productos p
                  LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                  LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria
                  WHERE p.id_producto = :id
                  GROUP BY p.id_producto
                  LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $row = $stmt->fetch();

        if ($row) {
            http_response_code(200);
            echo json_encode($this->formatProduct($row));
        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Producto no encontrado"]);
        }
    }

    public function create($data) {
        try {
            $this->conn->beginTransaction();

            $nombre = trim($data['name'] ?? '');
            $descripcion = trim($data['description'] ?? '');
            $precioBase = (float)($data['price'] ?? 0);
            $stock = max(0, (int)($data['stock'] ?? 0));
            $imagen = trim($data['image'] ?? '');
            $destacado = isset($data['featured']) ? (int)$data['featured'] : 1;

            $imagenesJson = json_encode($imagen ? [$imagen] : [], JSON_UNESCAPED_UNICODE);
            $opcionesJson = $this->buildOptionsJson($data);

            // 1. Insertar producto
            $stmt = $this->conn->prepare("INSERT INTO productos (nombre, descripcion, precio_base, imagenes_base, destacado, opciones) 
                                          VALUES (:nombre, :descripcion, :precio, :imagenes, :destacado, :opciones)");
            $stmt->execute([
                ':nombre' => $nombre,
                ':descripcion' => $descripcion,
                ':precio' => $precioBase,
                ':imagenes' => $imagenesJson,
                ':destacado' => $destacado,
                ':opciones' => $opcionesJson
            ]);

            $productId = (int)$this->conn->lastInsertId();

            // 2. Insertar variante base con el stock
            $varStmt = $this->conn->prepare("INSERT INTO producto_variantes (id_producto, atributos, imagenes, stock, vendidos, precio_delta) 
                                             VALUES (:pid, '{}', :imagenes, :stock, 0, 0.00)");
            $varStmt->execute([
                ':pid' => $productId,
                ':imagenes' => $imagenesJson,
                ':stock' => $stock
            ]);

            // 3. Vincular categorías (incluyendo 'All' por defecto)
            $this->syncCategories($productId, $data['categories'] ?? []);

            $this->conn->commit();

            http_response_code(201);
            echo json_encode(["status" => "success", "message" => "Producto creado correctamente", "id" => $productId]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al crear producto: " . $e->getMessage()]);
        }
    }

    public function update($data) {
        $productId = (int)($data['id'] ?? 0);
        if ($productId <= 0) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "ID de producto inválido"]);
            return;
        }

        try {
            $this->conn->beginTransaction();

            $nombre = trim($data['name'] ?? '');
            $descripcion = trim($data['description'] ?? '');
            $precioBase = (float)($data['price'] ?? 0);
            $stock = max(0, (int)($data['stock'] ?? 0));
            $imagen = trim($data['image'] ?? '');

            $imagenesJson = json_encode($imagen ? [$imagen] : [], JSON_UNESCAPED_UNICODE);
            $opcionesJson = $this->buildOptionsJson($data);

            // 1. Actualizar tabla productos
            $stmt = $this->conn->prepare("UPDATE productos 
                                          SET nombre = :nombre, 
                                              descripcion = :descripcion, 
                                              precio_base = :precio, 
                                              imagenes_base = :imagenes, 
                                              opciones = :opciones 
                                          WHERE id_producto = :id");
            $stmt->execute([
                ':nombre' => $nombre,
                ':descripcion' => $descripcion,
                ':precio' => $precioBase,
                ':imagenes' => $imagenesJson,
                ':opciones' => $opcionesJson,
                ':id' => $productId
            ]);

            // 2. Actualizar stock en producto_variantes
            $varCheck = $this->conn->prepare("SELECT id_variante FROM producto_variantes WHERE id_producto = :pid ORDER BY id_variante ASC LIMIT 1");
            $varCheck->execute([':pid' => $productId]);
            $firstVar = $varCheck->fetch();

            if ($firstVar) {
                $this->conn->prepare("UPDATE producto_variantes SET stock = 0 WHERE id_producto = :pid")->execute([':pid' => $productId]);
                $updVar = $this->conn->prepare("UPDATE producto_variantes SET stock = :stock, imagenes = :imagenes WHERE id_variante = :vid");
                $updVar->execute([
                    ':stock' => $stock,
                    ':imagenes' => $imagenesJson,
                    ':vid' => (int)$firstVar['id_variante']
                ]);
            } else {
                $insVar = $this->conn->prepare("INSERT INTO producto_variantes (id_producto, atributos, imagenes, stock, vendidos, precio_delta) 
                                                VALUES (:pid, '{}', :imagenes, :stock, 0, 0.00)");
                $insVar->execute([
                    ':pid' => $productId,
                    ':imagenes' => $imagenesJson,
                    ':stock' => $stock
                ]);
            }

            // 3. Sincronizar categorías (manteniendo siempre 'All')
            $this->syncCategories($productId, $data['categories'] ?? []);

            $this->conn->commit();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Producto actualizado correctamente"]);

        } catch (Exception $e) {
            $this->conn->rollBack();
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "Error al actualizar producto: " . $e->getMessage()]);
        }
    }

    public function delete($id) {
        $productId = (int)$id;
        try {
            $stmt = $this->conn->prepare("DELETE FROM productos WHERE id_producto = :id");
            $stmt->bindParam(':id', $productId, PDO::PARAM_INT);
            $stmt->execute();

            http_response_code(200);
            echo json_encode(["status" => "success", "message" => "Producto eliminado correctamente"]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "No se pudo eliminar (puede tener órdenes asociadas): " . $e->getMessage()]);
        }
    }

    private function buildOptionsJson($data) {
        $opciones = [];
        if (!empty($data['sizes'])) {
            $opciones[] = ["name" => "Size", "values" => array_values($data['sizes'])];
        }
        if (!empty($data['colors'])) {
            $opciones[] = ["name" => "Color", "values" => array_values($data['colors'])];
        }
        if (!empty($data['materials'])) {
            $opciones[] = ["name" => "Material", "values" => array_values($data['materials'])];
        }
        return json_encode($opciones, JSON_UNESCAPED_UNICODE);
    }

    private function syncCategories($productId, $selectedNames) {
        // Limpiar asociaciones actuales
        $delStmt = $this->conn->prepare("DELETE FROM producto_categorias WHERE id_producto = :pid");
        $delStmt->execute([':pid' => $productId]);

        // Asegurar que 'All' siempre esté incluido por defecto
        $namesToLink = array_unique(array_merge(['All'], is_array($selectedNames) ? $selectedNames : []));

        $findCat = $this->conn->prepare("SELECT id_categoria FROM categorias WHERE LOWER(nombre) = LOWER(:nombre) LIMIT 1");
        $insertLink = $this->conn->prepare("INSERT IGNORE INTO producto_categorias (id_producto, id_categoria) VALUES (:pid, :cid)");

        foreach ($namesToLink as $catName) {
            $cleanName = trim($catName);
            if ($cleanName === '') continue;

            $findCat->execute([':nombre' => $cleanName]);
            $catRow = $findCat->fetch();

            if ($catRow) {
                $insertLink->execute([
                    ':pid' => $productId,
                    ':cid' => (int)$catRow['id_categoria']
                ]);
            }
        }
    }

    private function formatProduct($row) {
        $imagenes = json_decode($row['imagenes_base'], true) ?: [];
        $opciones = json_decode($row['opciones'], true) ?: [];

        $rawCategories = !empty($row['categorias']) ? explode(',', $row['categorias']) : [];
        $categoriesList = array_values(array_filter($rawCategories, function($cat) {
            return strtolower(trim($cat)) !== 'all';
        }));

        $sizes = [];
        $colors = [];
        $materials = [];

        foreach ($opciones as $opt) {
            $name = strtolower($opt['name'] ?? '');
            if ($name === 'size' || $name === 'talla') $sizes = $opt['values'] ?? [];
            if ($name === 'color') $colors = $opt['values'] ?? [];
            if ($name === 'material') $materials = $opt['values'] ?? [];
        }

        $basePrice = (float)$row['precio_base'];
        $discount = (float)$row['max_descuento'];
        $finalPrice = $discount > 0 ? $basePrice * (1 - ($discount / 100)) : $basePrice;

        return [
            "id" => (string)$row['id_producto'],
            "name" => $row['nombre'],
            "price" => round($finalPrice, 2),
            "originalPrice" => $basePrice,
            "discount" => $discount,
            "image" => $imagenes[0] ?? '',
            "description" => $row['descripcion'],
            "category" => $categoriesList[0] ?? 'All',
            "categories" => $categoriesList,
            "stock" => (int)$row['stock_total'],
            "featured" => (bool)$row['destacado'],
            "sizes" => $sizes,
            "colors" => $colors,
            "materials" => $materials
        ];
    }
}
?>