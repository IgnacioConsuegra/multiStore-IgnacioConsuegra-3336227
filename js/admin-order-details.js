document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || String(user.role).toLowerCase() !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');

    const loadingEl = document.getElementById('order-loading');
    const errorEl = document.getElementById('order-error');
    const contentEl = document.getElementById('order-details-content');

    if (!orderId) {
        loadingEl.classList.add('d-none');
        errorEl.classList.remove('d-none');
        return;
    }

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
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function loadOrderDetails() {
        try {
            const response = await fetch(`../backend/api/orders.php?id=${encodeURIComponent(orderId)}&t=${Date.now()}`, {
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('Orden no encontrada');
            }

            const order = await response.json();
            renderOrderDetails(order);
        } catch (error) {
            console.error('Error cargando detalle de orden:', error);
            loadingEl.classList.add('d-none');
            errorEl.classList.remove('d-none');
        }
    }

    function renderOrderDetails(order) {
        document.title = `${order.orderCode} Details - Academia Admin`;

        // Cabecera
        document.getElementById('detail-order-code').textContent = `${order.orderCode} (#${order.orderId})`;
        document.getElementById('detail-order-date').textContent = formatDate(order.date);

        const statusBadge = document.getElementById('detail-status-badge');
        statusBadge.textContent = order.status;
        statusBadge.className = `status-badge ${getStatusClass(order.status)}`;

        const statusSelect = document.getElementById('detail-status-select');
        statusSelect.value = order.status;
        statusSelect.addEventListener('change', async () => {
            const newStatus = statusSelect.value;
            try {
                const res = await fetch('../backend/api/orders.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.orderId, status: newStatus })
                });
                const result = await res.json();
                if (res.ok && result.status === 'success') {
                    statusBadge.textContent = result.newStatus;
                    statusBadge.className = `status-badge ${getStatusClass(result.newStatus)}`;
                } else {
                    alert(result.message || 'Could not update status.');
                }
            } catch (err) {
                console.error(err);
                alert('Server connection error.');
            }
        });

        // Datos del comprador
        const buyer = order.user || {};
        document.getElementById('detail-buyer-name').textContent = buyer.name || 'Guest Customer';
        document.getElementById('detail-buyer-email').textContent = buyer.email || 'Not provided';
        document.getElementById('detail-buyer-phone').textContent = buyer.phone || 'Not provided';

        // Dirección de envío
        const addr = order.shippingAddress || {};
        document.getElementById('detail-ship-street').textContent = addr.street || 'Not provided';
        document.getElementById('detail-ship-city').textContent = addr.city || 'Not provided';
        document.getElementById('detail-ship-state').textContent = addr.state || 'Not provided';
        document.getElementById('detail-ship-zip').textContent = addr.zipCode || 'Not provided';
        document.getElementById('detail-ship-country').textContent = addr.country || 'Not provided';

        // Productos comprados y variantes
        const items = Array.isArray(order.items) ? order.items : [];
        document.getElementById('detail-items-count').textContent = items.reduce((sum, i) => sum + i.quantity, 0);

        const itemsTbody = document.getElementById('detail-items-tbody');
        itemsTbody.innerHTML = items.map(item => {
            const attrs = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
            const attrKeys = Object.keys(attrs);

            const variantsHtml = attrKeys.length > 0
                ? attrKeys.map(k => `<span class="badge bg-light text-dark border me-1 mt-1 fw-normal">${k}: <strong>${attrs[k]}</strong></span>`).join('')
                : `<span class="text-muted-custom small d-block mt-1">Standard / Base variant</span>`;

            return `
                <tr>
                    <td class="px-4 py-3">
                        <div class="d-flex align-items-center gap-3">
                            <img src="${item.image || ''}" alt="${item.name}" class="product-img-table flex-shrink-0">
                            <div>
                                <a href="productDetails.html?id=${encodeURIComponent(item.productId)}" 
                                   class="fw-semibold text-dark-custom text-decoration-none d-block">
                                    ${item.name}
                                </a>
                                <div class="d-flex flex-wrap">${variantsHtml}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center fw-medium text-dark-custom">${item.quantity}</td>
                    <td class="px-4 py-3 text-end text-muted-custom">$${Number(item.price).toFixed(2)}</td>
                    <td class="px-4 py-3 text-end font-heading fw-bold text-dark-custom">$${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        // Totales
        const totals = order.totals || { subtotal: 0, shipping: 0, total: 0 };
        document.getElementById('detail-subtotal').textContent = `$${Number(totals.subtotal).toFixed(2)}`;
        document.getElementById('detail-shipping').textContent = Number(totals.shipping) === 0
            ? 'FREE'
            : `$${Number(totals.shipping).toFixed(2)}`;
        document.getElementById('detail-total').textContent = `$${Number(totals.total).toFixed(2)}`;

        loadingEl.classList.add('d-none');
        contentEl.classList.remove('d-none');
    }

    loadOrderDetails();
});