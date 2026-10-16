document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificación de Autenticación
    let user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Manejo de Pestañas
    const tabProfile = document.getElementById('tab-profile');
    const tabOrders = document.getElementById('tab-orders');
    const secProfile = document.getElementById('section-profile');
    const secOrders = document.getElementById('section-orders');

    tabProfile.addEventListener('click', () => {
        tabProfile.classList.add('active');
        tabOrders.classList.remove('active');
        secProfile.classList.remove('d-none');
        secOrders.classList.add('d-none');
    });

    tabOrders.addEventListener('click', () => {
        tabOrders.classList.add('active');
        tabProfile.classList.remove('active');
        secOrders.classList.remove('d-none');
        secProfile.classList.add('d-none');
        renderOrders();
    });

    // 3. Lógica de Perfil (Visualización y Edición)
    const formInputs = document.querySelectorAll('#profile-form input');
    const btnEdit = document.getElementById('btn-edit-profile');
    const viewActions = document.getElementById('profile-actions-view');
    const editActions = document.getElementById('profile-actions-edit');
    const btnSave = document.getElementById('btn-save-profile');
    const btnCancel = document.getElementById('btn-cancel-profile');
    const btnLogout = document.getElementById('btn-logout');

    function loadUserData() {
        document.getElementById('prof-name').value = user.name || '';
        document.getElementById('prof-email').value = user.email || '';
        document.getElementById('prof-phone').value = user.phone || '';
        document.getElementById('prof-role').textContent = user.role || 'Customer';

        if (user.address) {
            document.getElementById('prof-street').value = user.address.street || '';
            document.getElementById('prof-city').value = user.address.city || '';
            document.getElementById('prof-state').value = user.address.state || '';
            document.getElementById('prof-zip').value = user.address.zipCode || '';
            document.getElementById('prof-country').value = user.address.country || '';
        }
    }

    function toggleEditMode(enable) {
        formInputs.forEach(input => {
            // Prevenir la edición del email por seguridad (opcional, ajustado al React original)
            if (input.id === 'prof-email') return; 
            input.disabled = !enable;
        });

        if (enable) {
            viewActions.classList.add('d-none');
            editActions.classList.remove('d-none');
        } else {
            viewActions.classList.remove('d-none');
            editActions.classList.add('d-none');
        }
    }

    btnEdit.addEventListener('click', (e) => {
        e.preventDefault();
        toggleEditMode(true);
    });

    btnCancel.addEventListener('click', (e) => {
        e.preventDefault();
        loadUserData(); // Restaurar datos originales
        toggleEditMode(false);
    });

    btnSave.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Actualizar objeto usuario
        user.name = document.getElementById('prof-name').value;
        user.phone = document.getElementById('prof-phone').value;
        
        if (!user.address) user.address = {};
        user.address.street = document.getElementById('prof-street').value;
        user.address.city = document.getElementById('prof-city').value;
        user.address.state = document.getElementById('prof-state').value;
        user.address.zipCode = document.getElementById('prof-zip').value;
        user.address.country = document.getElementById('prof-country').value;

        // Guardar en localStorage
        localStorage.setItem('user', JSON.stringify(user));
        toggleEditMode(false);
        
        // Actualizar navbar si la función existe globalmente
        if(typeof initNavBar === 'function') initNavBar();
    });

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Carga inicial de datos del perfil
    loadUserData();

    // 4. Lógica de Historial de Órdenes
    function getStatusClass(status) {
        const s = status.toLowerCase();
        if (s.includes('pending')) return 'status-pending';
        if (s.includes('processing')) return 'status-processing';
        if (s.includes('completed') || s.includes('delivered')) return 'status-completed';
        return 'bg-secondary text-white';
    }

    function renderOrders() {
        const allOrders = JSON.parse(localStorage.getItem('orders')) || [];
        // Filtrar órdenes que pertenezcan a este usuario mediante su email o id
        const userOrders = allOrders.filter(o => o.user && o.user.email === user.email);
        
        const container = document.getElementById('orders-container');
        const emptyState = document.getElementById('orders-empty');

        container.innerHTML = '';

        if (userOrders.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');

        // Ordenar de más reciente a más antigua
        userOrders.reverse().forEach(order => {
            const itemsHtml = order.items.map(item => `
                <div class="d-flex align-items-center gap-3">
                    <img src="${item.image}" alt="${item.name}" class="order-item-img flex-shrink-0">
                    <div class="flex-grow-1 min-vw-0">
                        <p class="fw-medium text-dark-custom mb-0 text-truncate">${item.name}</p>
                        <p class="text-muted-custom small mb-0">${item.category}</p>
                    </div>
                    <div class="text-end flex-shrink-0">
                        <p class="fw-medium text-dark-custom mb-0">$${item.price.toFixed(2)}</p>
                        <p class="text-muted-custom small mb-0">Qty: ${item.quantity}</p>
                    </div>
                </div>
            `).join('');

            // Asegurar lectura segura de los totales guardados
            const total = order.totals ? order.totals.total : order.items.reduce((acc, it) => acc + (it.price * it.quantity), 0);
            
            // Formatear Fecha
            const dateObj = new Date(order.date);
            const dateString = isNaN(dateObj) ? order.date : dateObj.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            container.innerHTML += `
                <div class="order-card">
                    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                        <div>
                            <div class="d-flex align-items-center gap-3 mb-1">
                                <h3 class="font-heading fs-5 fw-semibold text-dark-custom mb-0">Order #${order.orderId}</h3>
                                <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
                            </div>
                            <p class="text-muted-custom small mb-0">${dateString}</p>
                        </div>
                        <div class="text-md-end">
                            <p class="font-heading fs-4 fw-bold text-dark-custom mb-0">$${total.toFixed(2)}</p>
                            <p class="text-muted-custom small mb-0">${order.items.length} item${order.items.length > 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div class="d-flex flex-column gap-3 pt-4 border-top custom-border-light">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        });
    }
});