document.addEventListener('DOMContentLoaded', () => {
    let user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user.id) {
        window.location.href = 'login.html';
        return;
    }

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
        fetchAndRenderOrders();
    });

    const formInputs = document.querySelectorAll('#profile-form input');
    const btnEdit = document.getElementById('btn-edit-profile');
    const viewActions = document.getElementById('profile-actions-view');
    const editActions = document.getElementById('profile-actions-edit');
    const btnSave = document.getElementById('btn-save-profile');
    const btnCancel = document.getElementById('btn-cancel-profile');
    const btnLogout = document.getElementById('btn-logout');

    // 1. Cargar datos frescos del usuario desde MySQL
    async function fetchUserData() {
        fillForm(user); // Pintado inmediato con caché local mientras responde la API
        try {
            const response = await fetch(`../backend/api/user.php?id=${encodeURIComponent(user.id)}`);
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                user = result.user;
                localStorage.setItem('user', JSON.stringify(user));
                fillForm(user);
            }
        } catch (error) {
            console.error('Error cargando datos del perfil:', error);
        }
    }

    function fillForm(userData) {
        document.getElementById('prof-name').value = userData.name || '';
        document.getElementById('prof-email').value = userData.email || '';
        document.getElementById('prof-phone').value = userData.phone || '';
        document.getElementById('prof-role').textContent = userData.role || 'Customer';

        const addr = userData.address || {};
        document.getElementById('prof-street').value = addr.street || '';
        document.getElementById('prof-city').value = addr.city || '';
        document.getElementById('prof-state').value = addr.state || '';
        document.getElementById('prof-zip').value = addr.zipCode || '';
        document.getElementById('prof-country').value = addr.country || '';
    }

    function toggleEditMode(enable) {
        formInputs.forEach(input => {
            if (input.id === 'prof-email') return; // El correo no se edita
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
        fillForm(user);
        toggleEditMode(false);
    });

    // 2. Guardar cambios del perfil en MySQL
    btnSave.addEventListener('click', async (e) => {
        e.preventDefault();

        const updatedPayload = {
            id: user.id,
            name: document.getElementById('prof-name').value.trim(),
            phone: document.getElementById('prof-phone').value.trim(),
            address: {
                street: document.getElementById('prof-street').value.trim(),
                city: document.getElementById('prof-city').value.trim(),
                state: document.getElementById('prof-state').value.trim(),
                zipCode: document.getElementById('prof-zip').value.trim(),
                country: document.getElementById('prof-country').value.trim()
            }
        };

        const originalSaveHtml = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch('../backend/api/user.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPayload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                user = result.user;
                localStorage.setItem('user', JSON.stringify(user));
                fillForm(user);
                toggleEditMode(false);

                if (typeof initNavBar === 'function') initNavBar();
            } else {
                alert(result.message || 'No se pudieron guardar los cambios.');
            }
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            alert('Error de conexión con el servidor.');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalSaveHtml;
        }
    });

    btnLogout.addEventListener('click', async () => {
        try {
            await fetch('../backend/api/logout.php', {
                method: 'POST',
                credentials: 'same-origin'
            });
        } catch (error) {
            console.error('Error cerrando sesión en el servidor:', error);
        } finally {
            localStorage.removeItem('user');
            localStorage.removeItem('cart');
            window.location.href = '../index.html';
        }
    });
    // 4. Cargar y renderizar historial de órdenes desde MySQL
    function getStatusClass(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('pending')) return 'status-pending';
        if (s.includes('processing')) return 'status-processing';
        if (s.includes('paid') || s.includes('completed') || s.includes('delivered')) return 'status-completed';
        return 'bg-secondary text-white';
    }

    async function fetchAndRenderOrders() {
        const container = document.getElementById('orders-container');
        const emptyState = document.getElementById('orders-empty');

        container.innerHTML = '<p class="text-muted-custom">Loading your orders...</p>';
        emptyState.classList.add('d-none');

        try {
            const response = await fetch(`../backend/api/orders.php?userId=${encodeURIComponent(user.id)}`, {
                method: 'GET',
                credentials: 'same-origin'
            });
            if (!response.ok) throw new Error('Error al obtener órdenes');

            const userOrders = await response.json();
            container.innerHTML = '';

            if (!userOrders || userOrders.length === 0) {
                emptyState.classList.remove('d-none');
                return;
            }

            userOrders.forEach(order => {
                const itemsHtml = order.items.map(item => `
                    <div class="d-flex align-items-center gap-3">
                        <img src="${item.image}" alt="${item.name}" class="order-item-img flex-shrink-0">
                        <div class="flex-grow-1 min-vw-0">
                            <p class="fw-medium text-dark-custom mb-0 text-truncate">${item.name}</p>
                            <p class="text-muted-custom small mb-0">${item.category}</p>
                        </div>
                        <div class="text-end flex-shrink-0">
                            <p class="fw-medium text-dark-custom mb-0">$${Number(item.price).toFixed(2)}</p>
                            <p class="text-muted-custom small mb-0">Qty: ${item.quantity}</p>
                        </div>
                    </div>
                `).join('');

                const dateObj = new Date(order.date);
                const dateString = isNaN(dateObj) ? order.date : dateObj.toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });

                container.innerHTML += `
                    <div class="order-card">
                        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                            <div>
                                <div class="d-flex align-items-center gap-3 mb-1">
                                    <h3 class="font-heading fs-5 fw-semibold text-dark-custom mb-0">${dateString}</h3>
                                    <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
                                </div>
                            </div>
                            <div class="text-md-end">
                                <p class="font-heading fs-4 fw-bold text-dark-custom mb-0">$${Number(order.total).toFixed(2)}</p>
                                <p class="text-muted-custom small mb-0">${order.items.length} item${order.items.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div class="d-flex flex-column gap-3 pt-4 border-top custom-border-light">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
            });
        } catch (error) {
            console.error('Error cargando órdenes:', error);
            container.innerHTML = '<p class="text-danger">Error loading order history.</p>';
        }
    }

    // Iniciar cargando perfil
    fetchUserData();
});