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
                    ) AS max_descuento
                  FROM productos p
                  LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                  LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria
                  GROUP BY p.id_producto
                  ORDER BY p.id_producto ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $varStmt = $this->conn->query("SELECT id_variante, id_producto, atributos, imagenes, stock, vendidos, precio_delta 
                                       FROM producto_variantes 
                                       ORDER BY id_variante ASC");
        $variantsByProduct = [];
        foreach ($varStmt->fetchAll() as $vRow) {
            $variantsByProduct[$vRow['id_producto']][] = $vRow;
        }

        $products = array_map(function($row) use ($variantsByProduct) {
            $prodVariants = $variantsByProduct[$row['id_producto']] ?? [];
            return $this->formatProduct($row, $prodVariants);
        }, $rows);

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
                    ) AS max_descuento
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
            $varStmt = $this->conn->prepare("SELECT id_variante, id_producto, atributos, imagenes, stock, vendidos, precio_delta 
                                             FROM producto_variantes 
                                             WHERE id_producto = :id 
                                             ORDER BY id_variante ASC");
            $varStmt->bindParam(':id', $id);
            $varStmt->execute();
            $prodVariants = $varStmt->fetchAll();

            http_response_code(200);
            echo json_encode($this->formatProduct($row, $prodVariants));
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
            $destacado = isset($data['featured']) ? (int)$data['featured'] : 1;

            $baseImages = $this->normalizeImagesArray($data['images'] ?? ($data['image'] ?? []));
            $imagenesJson = json_encode($baseImages, JSON_UNESCAPED_UNICODE);
            $opcionesJson = json_encode($data['options'] ?? [], JSON_UNESCAPED_UNICODE);

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

            $this->syncVariants($productId, $data['variants'] ?? [], $baseImages, $precioBase);
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

            $baseImages = $this->normalizeImagesArray($data['images'] ?? ($data['image'] ?? []));
            $imagenesJson = json_encode($baseImages, JSON_UNESCAPED_UNICODE);
            $opcionesJson = json_encode($data['options'] ?? [], JSON_UNESCAPED_UNICODE);

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

            $this->syncVariants($productId, $data['variants'] ?? [], $baseImages, $precioBase);
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

    private function normalizeImagesArray($input) {
        if (is_array($input)) {
            return array_values(array_filter(array_map('trim', $input), fn($u) => $u !== ''));
        }
        if (is_string($input) && trim($input) !== '') {
            $parts = preg_split('/[\r\n,]+/', $input);
            return array_values(array_filter(array_map('trim', $parts), fn($u) => $u !== ''));
        }
        return [];
    }

    private function syncVariants($productId, $variants, $fallbackImages, $basePrice) {
        if (empty($variants)) {
            $variants = [[
                'attributes' => new stdClass(),
                'stock' => 0,
                'sold' => 0,
                'price' => $basePrice,
                'images' => $fallbackImages
            ]];
        }

        $keptIds = [];

        $updStmt = $this->conn->prepare("UPDATE producto_variantes 
                                         SET atributos = :attrs, imagenes = :imgs, stock = :stock, vendidos = :sold, precio_delta = :delta 
                                         WHERE id_variante = :vid AND id_producto = :pid");

        $insStmt = $this->conn->prepare("INSERT INTO producto_variantes (id_producto, atributos, imagenes, stock, vendidos, precio_delta) 
                                         VALUES (:pid, :attrs, :imgs, :stock, :sold, :delta)");

        foreach ($variants as $v) {
            $vId = isset($v['id']) ? (int)$v['id'] : 0;
            $attrs = !empty($v['attributes']) ? $v['attributes'] : new stdClass();
            $attrsJson = json_encode($attrs, JSON_UNESCAPED_UNICODE);

            $varImages = $this->normalizeImagesArray($v['images'] ?? ($v['image'] ?? []));
            $imgsJson = json_encode($varImages, JSON_UNESCAPED_UNICODE);

            $stock = max(0, (int)($v['stock'] ?? 0));
            $sold = max(0, (int)($v['sold'] ?? 0));

            $variantPrice = (isset($v['price']) && $v['price'] !== '' && $v['price'] !== null)
                ? (float)$v['price']
                : $basePrice;
            $precioDelta = round($variantPrice - $basePrice, 2);

            if ($vId > 0) {
                $updStmt->execute([
                    ':attrs' => $attrsJson,
                    ':imgs' => $imgsJson,
                    ':stock' => $stock,
                    ':sold' => $sold,
                    ':delta' => $precioDelta,
                    ':vid' => $vId,
                    ':pid' => $productId
                ]);
                $keptIds[] = $vId;
            } else {
                $insStmt->execute([
                    ':pid' => $productId,
                    ':attrs' => $attrsJson,
                    ':imgs' => $imgsJson,
                    ':stock' => $stock,
                    ':sold' => $sold,
                    ':delta' => $precioDelta
                ]);
                $keptIds[] = (int)$this->conn->lastInsertId();
            }
        }

        if (!empty($keptIds)) {
            $placeholders = implode(',', array_fill(0, count($keptIds), '?'));
            $params = array_merge([$productId], $keptIds);

            try {
                $delStmt = $this->conn->prepare("DELETE FROM producto_variantes WHERE id_producto = ? AND id_variante NOT IN ($placeholders)");
                $delStmt->execute($params);
            } catch (Exception $e) {
                $zeroStmt = $this->conn->prepare("UPDATE producto_variantes SET stock = 0 WHERE id_producto = ? AND id_variante NOT IN ($placeholders)");
                $zeroStmt->execute($params);
            }
        }
    }

    private function syncCategories($productId, $selectedNames) {
        $delStmt = $this->conn->prepare("DELETE FROM producto_categorias WHERE id_producto = :pid");
        $delStmt->execute([':pid' => $productId]);

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

    private function formatProduct($row, $variantRows = []) {
        $imagenesBase = json_decode($row['imagenes_base'], true) ?: [];
        $opciones = json_decode($row['opciones'], true) ?: [];

        $rawCategories = !empty($row['categorias']) ? explode(',', $row['categorias']) : [];
        $categoriesList = array_values(array_filter($rawCategories, function($cat) {
            return strtolower(trim($cat)) !== 'all';
        }));

        $basePrice = (float)$row['precio_base'];
        $discount = (float)$row['max_descuento'];
        $finalPrice = $discount > 0 ? round($basePrice * (1 - ($discount / 100)), 2) : $basePrice;

        $formattedVariants = [];
        $totalStock = 0;
        $totalSold = 0;

        foreach ($variantRows as $vRow) {
            $vImgs = json_decode($vRow['imagenes'], true) ?: [];
            $vAttrs = json_decode($vRow['atributos'], true);
            if (!is_array($vAttrs)) $vAttrs = [];

            $vStock = (int)$vRow['stock'];
            $vSold = (int)$vRow['vendidos'];
            $vDelta = (float)($vRow['precio_delta'] ?? 0);

            $vOriginalPrice = round($basePrice + $vDelta, 2);
            $vFinalPrice = $discount > 0 ? round($vOriginalPrice * (1 - ($discount / 100)), 2) : $vOriginalPrice;

            $totalStock += $vStock;
            $totalSold += $vSold;

            $formattedVariants[] = [
                "id" => (int)$vRow['id_variante'],
                "attributes" => empty($vAttrs) ? new stdClass() : $vAttrs,
                "images" => $vImgs,
                "image" => $vImgs[0] ?? '',
                "stock" => $vStock,
                "sold" => $vSold,
                "originalPrice" => $vOriginalPrice,
                "price" => $vFinalPrice,
                "priceDelta" => $vDelta
            ];
        }

        $sizes = [];
        $colors = [];
        $materials = [];

        foreach ($opciones as $opt) {
            $name = strtolower($opt['name'] ?? '');
            if ($name === 'size' || $name === 'talla') $sizes = $opt['values'] ?? [];
            if ($name === 'color') $colors = $opt['values'] ?? [];
            if ($name === 'material') $materials = $opt['values'] ?? [];
        }

        return [
            "id" => (string)$row['id_producto'],
            "name" => $row['nombre'],
            "price" => $finalPrice,
            "originalPrice" => $basePrice,
            "discount" => $discount,
            "images" => $imagenesBase,
            "image" => $imagenesBase[0] ?? '',
            "description" => $row['descripcion'],
            "category" => $categoriesList[0] ?? 'All',
            "categories" => $categoriesList,
            "stock" => $totalStock,
            "sold" => $totalSold,
            "featured" => (bool)$row['destacado'],
            "options" => $opciones,
            "variants" => $formattedVariants,
            "sizes" => $sizes,
            "colors" => $colors,
            "materials" => $materials
        ];
    }
}
?>