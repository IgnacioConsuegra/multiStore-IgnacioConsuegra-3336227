document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || String(user.role).toLowerCase() !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    const tbody = document.getElementById('orders-tbody');
    const emptyState = document.getElementById('orders-empty');

    let orders = [];

    function getStatusClass(status) {
        const s = String(status || '').toLowerCase();
        if (s === 'pending') return 'status-pending';
        if (s === 'paid') return 'status-paid';
        if (s === 'processing') return 'status-processing';
        if (s === 'shipped') return 'status-shipped';
        if (s === 'delivered') return 'status-delivered';
        if (s === 'cancelled') return 'status-cancelled';
        return 'bg-secondary text-white';
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const normalized = String(dateString).replace(' ', 'T');
        const dateObj = new Date(normalized);
        if (isNaN(dateObj)) return dateString;

        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function fetchOrders() {
        try {
            const response = await fetch(`../backend/api/orders.php?t=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Error al obtener órdenes');
            orders = await response.json();
            renderOrders();
        } catch (error) {
            console.error('Error cargando órdenes:', error);
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Error loading orders from database.</td></tr>`;
        }
    }

    function renderOrders() {
        const pendingOrPaidCount = orders.filter(o => ['pending', 'paid'].includes(o.status.toLowerCase())).length;
        const processingCount = orders.filter(o => o.status.toLowerCase() === 'processing').length;

        const revenue = orders
            .filter(o => ['delivered', 'paid', 'processing', 'shipped'].includes(o.status.toLowerCase()))
            .reduce((acc, order) => acc + (order.totals ? Number(order.totals.total) : 0), 0);

        document.getElementById('stat-total-orders').textContent = orders.length;
        document.getElementById('stat-pending-orders').textContent = pendingOrPaidCount;
        document.getElementById('stat-processing-orders').textContent = processingCount;
        document.getElementById('stat-revenue').textContent = `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        tbody.innerHTML = '';

        if (orders.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');

        orders.forEach(order => {
            const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
            let productHtml = `<span class="text-muted-custom small">No items</span>`;

            if (firstItem) {
                const extraItemsTag = order.items.length > 1
                    ? `<span class="text-muted-custom small d-block mt-1">+ ${order.items.length - 1} more item(s)</span>`
                    : '';

                productHtml = `
                    <div class="d-flex align-items-center gap-3">
                        <div class="flex-shrink-0">
                            <img src="${firstItem.image || ''}" alt="${firstItem.name}" class="product-img-table">
                        </div>
                        <div class="min-vw-0">
                            <span class="d-block text-dark-custom small fw-medium text-truncate" style="max-width: 200px;">
                                ${firstItem.name}
                            </span>
                            ${extraItemsTag}
                        </div>
                    </div>
                `;
            }

            const total = order.totals ? Number(order.totals.total) : 0;
            const buyerName = order.user ? order.user.name : 'Guest Customer';
            const buyerEmail = order.user ? order.user.email : '';
            const buyerPhone = order.user && order.user.phone ? ` • ${order.user.phone}` : '';

            const tr = document.createElement('tr');
            tr.className = 'order-clickable-row';
            tr.title = 'Click to view full order details';

            // Abrir página de detalles al tocar la fila
            tr.addEventListener('click', () => {
                window.location.href = `admin-order-details.html?id=${encodeURIComponent(order.orderId)}`;
            });

            tr.innerHTML = `
                <td class="px-4 py-3">
                    <p class="font-heading fw-bold text-dark-custom mb-1">${order.orderCode} <span class="text-muted fw-normal small">(#${order.orderId})</span></p>
                    <p class="small fw-medium text-dark-custom mb-0">${buyerName}</p>
                    <p class="small text-muted-custom mb-1">${buyerEmail}${buyerPhone}</p>
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
                
                <td class="px-4 py-3 text-end" onclick="event.stopPropagation()">
                    <div class="d-inline-flex align-items-center gap-2">
                        <a href="admin-order-details.html?id=${encodeURIComponent(order.orderId)}" 
                           class="btn btn-sm btn-outline-dark rounded-1" 
                           title="View Order Details">
                            <i class="fa-solid fa-eye"></i>
                        </a>
                        <select class="form-select form-select-sm status-select d-inline-block w-auto" 
                                onchange="updateOrderStatus(${order.orderId}, this.value)">
                            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Paid" ${order.status === 'Paid' ? 'selected' : ''}>Paid</option>
                            <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.updateOrderStatus = async function (orderId, newStatus) {
        try {
            const response = await fetch('../backend/api/orders.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: newStatus })
            });

            const result = await response.json();
            if (response.ok && result.status === 'success') {
                const idx = orders.findIndex(o => Number(o.orderId) === Number(orderId));
                if (idx > -1) {
                    orders[idx].status = result.newStatus;
                    renderOrders();
                }
            } else {
                alert(result.message || 'Could not update order status.');
            }
        } catch (error) {
            console.error('Error actualizando estado:', error);
            alert('Server connection error.');
        }
    };

    fetchOrders();
});