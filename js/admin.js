document.addEventListener('DOMContentLoaded', () => {
    const products = JSON.parse(localStorage.getItem('currentProducts')) || [];
    const orders = JSON.parse(localStorage.getItem('orders')) || [];

    let totalRevenue = 0;
    let totalOrders = orders.length;
    let totalProducts = products.length;

    orders.forEach(order => {
        if (order.totals && order.totals.total) {
            totalRevenue += order.totals.total;
        }
    });

    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    document.getElementById('stat-revenue').textContent = `$${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('stat-orders').textContent = totalOrders;
    document.getElementById('stat-products').textContent = totalProducts;
    document.getElementById('stat-aov').textContent = `$${avgOrderValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`;

    const monthlyData = {};
    const categoryData = {};

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    orders.forEach(order => {
        const dateObj = new Date(order.date);
        const month = monthNames[dateObj.getMonth()];
        
        if (!monthlyData[month]) {
            monthlyData[month] = { sales: 0, orders: 0 };
        }
        monthlyData[month].sales += order.totals.total || 0;
        monthlyData[month].orders += 1;

        if (order.items) {
            order.items.forEach(item => {
                const cat = item.category || 'Uncategorized';
                if (!categoryData[cat]) categoryData[cat] = 0;
                categoryData[cat] += (item.price * item.quantity);
            });
        }
    });

    const sortedMonths = Object.keys(monthlyData).sort((a, b) => monthNames.indexOf(a) - monthNames.indexOf(b));
    
    const chartLabels = sortedMonths;
    const salesDataTrend = sortedMonths.map(m => monthlyData[m].sales);
    const ordersDataTrend = sortedMonths.map(m => monthlyData[m].orders);

    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);

    Chart.defaults.font.family = "'PT Serif', serif";
    Chart.defaults.color = '#6c757d';

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
                tension: 0.3
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
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    const pieColors = ['#A88844', '#3f523e', '#8B8C7A', '#D4AF37', '#2C2420'];
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

    const lowStockContainer = document.getElementById('low-stock-container');
    const lowStockProducts = products.filter(p => p.stock < 10);

    if (lowStockProducts.length > 0) {
        lowStockContainer.innerHTML = lowStockProducts.map(product => `
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
});