<?php
class AdminController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAnalytics() {
        try {
            // 1. Ingresos totales y total de órdenes válidas
            $kpiOrdersStmt = $this->conn->query("
                SELECT 
                    COALESCE(SUM(monto_total), 0) AS total_revenue,
                    COUNT(*) AS total_orders
                FROM ordenes
                WHERE estado != 'cancelled'
            ");
            $kpiOrders = $kpiOrdersStmt->fetch();

            $totalRevenue = (float)$kpiOrders['total_revenue'];
            $totalOrders = (int)$kpiOrders['total_orders'];
            $avgOrderValue = $totalOrders > 0 ? ($totalRevenue / $totalOrders) : 0;

            // 2. Total de productos registrados
            $kpiProdStmt = $this->conn->query("SELECT COUNT(*) AS total_products FROM productos");
            $totalProducts = (int)$kpiProdStmt->fetch()['total_products'];

            // 3. Tendencia mensual (Ventas y Órdenes por mes)
            $monthlyStmt = $this->conn->query("
                SELECT 
                    DATE_FORMAT(creado_en, '%Y-%m') AS ym,
                    DATE_FORMAT(creado_en, '%b') AS month_label,
                    COALESCE(SUM(monto_total), 0) AS sales,
                    COUNT(*) AS orders
                FROM ordenes
                WHERE estado != 'cancelled'
                GROUP BY ym, month_label
                ORDER BY ym ASC
            ");
            $monthlyRows = $monthlyStmt->fetchAll();

            $monthlyTrend = array_map(function($row) {
                return [
                    "month" => $row['month_label'],
                    "sales" => (float)$row['sales'],
                    "orders" => (int)$row['orders']
                ];
            }, $monthlyRows);

            // 4. Ventas por categoría (excluyendo 'All')
            $categoryStmt = $this->conn->query("
                SELECT 
                    COALESCE(c.nombre, 'Uncategorized') AS category,
                    COALESCE(SUM(oi.precio * oi.cantidad), 0) AS total_sales
                FROM ordenes_items oi
                INNER JOIN ordenes o ON oi.id_orden = o.id_orden
                LEFT JOIN producto_categorias pc ON oi.id_producto = pc.id_producto
                LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria AND LOWER(c.nombre) != 'all'
                WHERE o.estado != 'cancelled'
                GROUP BY category
                ORDER BY total_sales DESC
            ");
            $categoryRows = $categoryStmt->fetchAll();

            $salesByCategory = array_map(function($row) {
                return [
                    "category" => $row['category'],
                    "sales" => (float)$row['total_sales']
                ];
            }, $categoryRows);

            // 5. Productos con bajo stock (< 10 unidades)
            $lowStockStmt = $this->conn->query("
                SELECT 
                    p.id_producto,
                    p.nombre,
                    p.imagenes_base,
                    COALESCE(GROUP_CONCAT(DISTINCT c.nombre SEPARATOR ', '), 'Uncategorized') AS category,
                    COALESCE((SELECT SUM(stock) FROM producto_variantes WHERE id_producto = p.id_producto), 0) AS stock
                FROM productos p
                LEFT JOIN producto_categorias pc ON p.id_producto = pc.id_producto
                LEFT JOIN categorias c ON pc.id_categoria = c.id_categoria AND LOWER(c.nombre) != 'all'
                GROUP BY p.id_producto, p.nombre, p.imagenes_base
                HAVING stock < 10
                ORDER BY stock ASC
            ");
            $lowStockRows = $lowStockStmt->fetchAll();

            $lowStockProducts = array_map(function($row) {
                $images = json_decode($row['imagenes_base'], true) ?: [];
                return [
                    "id" => (string)$row['id_producto'],
                    "name" => $row['nombre'],
                    "image" => $images[0] ?? '',
                    "category" => $row['category'] ?: 'Uncategorized',
                    "stock" => (int)$row['stock']
                ];
            }, $lowStockRows);

            http_response_code(200);
            echo json_encode([
                "status" => "success",
                "kpis" => [
                    "totalRevenue" => round($totalRevenue, 2),
                    "totalOrders" => $totalOrders,
                    "totalProducts" => $totalProducts,
                    "avgOrderValue" => round($avgOrderValue, 2)
                ],
                "monthlyTrend" => $monthlyTrend,
                "salesByCategory" => $salesByCategory,
                "lowStock" => $lowStockProducts
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                "status" => "error",
                "message" => "Error cargando analíticas: " . $e->getMessage()
            ]);
        }
    }
}
?>