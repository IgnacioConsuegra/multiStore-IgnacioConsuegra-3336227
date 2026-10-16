document.addEventListener('DOMContentLoaded', () => {
    
    // Verificación de Autenticación (Opcional, asumiendo que tienes un control de roles global)
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'Admin') {
        window.location.href = '../index.html'; // Redirigir si no es admin
        return;
    }

    const tbody = document.getElementById('orders-tbody');
    const emptyState = document.getElementById('orders-empty');
    
    let orders = JSON.parse(localStorage.getItem('orders')) || [];

    function getStatusClass(status) {
        const s = status.toLowerCase();
        if (s === 'pending') return 'status-pending';
        if (s === 'processing') return 'status-processing';
        if (s === 'shipped') return 'status-shipped';
        if (s === 'delivered') return 'status-delivered';
        if (s === 'cancelled') return 'status-cancelled';
        return 'bg-secondary text-white';
    }

    function formatDate(dateString) {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj)) return dateString; 
        
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function renderOrders() {
        // 1. Actualizar Estadísticas
        const pendingCount = orders.filter(o => o.status === 'Pending').length;
        const processingCount = orders.filter(o => o.status === 'Processing').length;
        
        // Sumar ingresos solo de órdenes completadas (Delivered)
        const revenue = orders
            .filter(o => o.status === 'Delivered')
            .reduce((acc, order) => acc + (order.totals ? order.totals.total : 0), 0);

        document.getElementById('stat-total-orders').textContent = orders.length;
        document.getElementById('stat-pending-orders').textContent = pendingCount;
        document.getElementById('stat-processing-orders').textContent = processingCount;
        document.getElementById('stat-revenue').textContent = `$${revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

        // 2. Renderizar Tabla
        tbody.innerHTML = '';

        if (orders.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');

        // Renderizar de más reciente a más antigua
        [...orders].reverse().forEach(order => {
            
            // Lógica para mostrar los productos de la orden
            const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
            let productHtml = `<span class="text-muted-custom small">No items</span>`;
            
            if (firstItem) {
                const extraItemsTag = order.items.length > 1 
                    ? `<span class="text-muted-custom small d-block mt-1">+ ${order.items.length - 1} more item(s)</span>` 
                    : '';
                
                productHtml = `
                    <div class="d-flex align-items-center gap-3">
                        <div class="flex-shrink-0">
                            <img src="${firstItem.image}" alt="${firstItem.name}" class="product-img-table">
                        </div>
                        <div class="min-vw-0">
                            <span class="d-block text-dark-custom small fw-medium text-truncate" style="max-width: 180px;">
                                ${firstItem.name}
                            </span>
                            ${extraItemsTag}
                        </div>
                    </div>
                `;
            }

            const total = order.totals ? order.totals.total : 0;
            const buyerName = order.user ? (order.user.name || order.user.email) : 'Unknown Buyer';
            const buyerEmail = order.user ? order.user.email : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-4 py-3">
                    <p class="font-heading fw-bold text-dark-custom mb-1">${order.orderId}</p>
                    <p class="small fw-medium text-dark-custom mb-0">${buyerName}</p>
                    <p class="small text-muted-custom mb-1">${buyerEmail}</p>
                    <p class="small text-muted-custom mb-0" style="font-size: 0.75rem;">${formatDate(order.date)}</p>
                </td>
                
                <td class="px-4 py-3">
                    ${productHtml}
                </td>
                
                <td class="px-4 py-3 font-heading fw-semibold text-dark-custom">
                    $${total.toFixed(2)}
                </td>
                
                <td class="px-4 py-3">
                    <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
                </td>
                
                <td class="px-4 py-3 text-end">
                    <select class="form-select form-select-sm status-select d-inline-block w-auto" onchange="updateOrderStatus('${order.orderId}', this.value)">
                        <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Mark Pending</option>
                        <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Mark Processing</option>
                        <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Mark Shipped</option>
                        <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Mark Delivered</option>
                        <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancel Order</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 3. Función global para actualizar el estado
    window.updateOrderStatus = function(orderId, newStatus) {
        const orderIndex = orders.findIndex(o => o.orderId === orderId);
        
        if (orderIndex > -1) {
            orders[orderIndex].status = newStatus;
            localStorage.setItem('orders', JSON.stringify(orders));
            renderOrders(); // Re-renderizar para actualizar badges y estadísticas
        }
    };

    // Renderizado inicial
    renderOrders();
});