document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('../backend/api/admin-analytics.php');
        if (!response.ok) throw new Error('Error al obtener las analíticas');

        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message || 'Respuesta inválida');

        const { kpis, monthlyTrend, salesByCategory, lowStock } = data;

        // 1. Actualizar tarjetas KPI
        document.getElementById('stat-revenue').textContent = `$${Number(kpis.totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('stat-orders').textContent = kpis.totalOrders;
        document.getElementById('stat-products').textContent = kpis.totalProducts;
        document.getElementById('stat-aov').textContent = `$${Number(kpis.avgOrderValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

        // 2. Configurar Chart.js
        Chart.defaults.font.family = "'PT Serif', serif";
        Chart.defaults.color = '#6c757d';

        const chartLabels = monthlyTrend.map(item => item.month);
        const salesDataTrend = monthlyTrend.map(item => item.sales);
        const ordersDataTrend = monthlyTrend.map(item => item.orders);

        // Gráfica de Línea: Sales Trend
        const ctxSales = document.getElementById('salesTrendChart').getContext('2d');
        new Chart(ctxSales, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Sales ($)',
                    data: salesDataTrend,
                    borderColor: '#3f523e',
                    backgroundColor: 'rgba(63, 82, 62, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#3f523e',
                    pointRadius: 4,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Gráfica de Barras: Orders by Month
        const ctxOrders = document.getElementById('ordersMonthChart').getContext('2d');
        new Chart(ctxOrders, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Orders',
                    data: ordersDataTrend,
                    backgroundColor: '#3f523e',
                    borderRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        // Gráfica Circular: Sales by Category
        const categoryLabels = salesByCategory.map(item => item.category);
        const categoryValues = salesByCategory.map(item => item.sales);
        const pieColors = ['#A88844', '#3f523e', '#8B8C7A', '#D4AF37', '#2C2420', '#5C6B73'];

        const ctxCategory = document.getElementById('categoryPieChart').getContext('2d');
        new Chart(ctxCategory, {
            type: 'pie',
            data: {
                labels: categoryLabels,
                datasets: [{
                    data: categoryValues,
                    backgroundColor: pieColors.slice(0, categoryLabels.length),
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        // 3. Renderizar alerta de Low Stock
        const lowStockContainer = document.getElementById('low-stock-container');
        if (lowStock && lowStock.length > 0) {
            lowStockContainer.innerHTML = lowStock.map(product => `
                <div class="stock-item">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${product.image}" alt="${product.name}">
                        <div>
                            <p class="mb-0 fw-medium text-dark-custom">${product.name}</p>
                            <p class="mb-0 small text-muted-custom">${product.category}</p>
                        </div>
                    </div>
                    <div>
                        <span class="text-accent fw-bold">${product.stock} left</span>
                    </div>
                </div>
            `).join('');
        } else {
            lowStockContainer.innerHTML = `<p class="text-muted-custom mb-0">All products have sufficient stock.</p>`;
        }

    } catch (error) {
        console.error('Error cargando el dashboard de administración:', error);
    }
});