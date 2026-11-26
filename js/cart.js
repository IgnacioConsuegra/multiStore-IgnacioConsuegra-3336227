document.addEventListener('DOMContentLoaded', () => {
    const emptyState = document.getElementById('empty-cart-state');
    const populatedState = document.getElementById('populated-cart-state');
    const itemsContainer = document.getElementById('cart-items-container');

    const subtotalEl = document.getElementById('summary-subtotal');
    const shippingEl = document.getElementById('summary-shipping');
    const shippingNoticeEl = document.getElementById('shipping-notice');
    const totalEl = document.getElementById('summary-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    const FREE_SHIPPING_THRESHOLD = 200;
    const STANDARD_SHIPPING_COST = 15;

    const currentUser = JSON.parse(localStorage.getItem('user'));

    // Si no hay sesión iniciada, mostrar estado vacío o redirigir al login
    if (!currentUser || !currentUser.id) {
        showEmptyState();
        return;
    }

    let cartItems = [];

    // 1. Cargar carrito desde MySQL
    async function fetchCart() {
        try {
            const response = await fetch(`../backend/api/cart.php?userId=${encodeURIComponent(currentUser.id)}`, {
                method: 'GET',  
                credentials: 'same-origin'
            });
            if (!response.ok) throw new Error('Error al cargar el carrito');

            cartItems = await response.json();
            renderCart();
        } catch (error) {
            console.error('Error cargando carrito:', error);
            showEmptyState();
        }
    }

    function showEmptyState() {
        if (emptyState) emptyState.classList.remove('d-none');
        if (populatedState) populatedState.classList.add('d-none');
        updateNavbarBadge(0);
    }

    function updateNavbarBadge(totalCount) {
        const badges = document.querySelectorAll('.cart-badge, #cart-count');
        badges.forEach(badge => {
            badge.textContent = totalCount;
            if (totalCount > 0) {
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        });
    }

    // 2. Renderizar lista de productos y resumen
  // 2. Renderizar lista de productos y resumen
    function renderCart() {
        if (!cartItems || cartItems.length === 0) {
            showEmptyState();
            return;
        }

        if (emptyState) emptyState.classList.add('d-none');
        if (populatedState) populatedState.classList.remove('d-none');

        itemsContainer.innerHTML = '';
        let subtotal = 0;
        let totalUnits = 0;

        cartItems.forEach(item => {
            const hasDiscount = item.discount > 0;
            const itemTotal = item.price * item.quantity;
            const itemOriginalTotal = item.originalPrice * item.quantity;

            subtotal += itemTotal;
            totalUnits += item.quantity;

            // Variantes seleccionadas
            const variants = [];
            if (item.selectedSize) variants.push(`Size: ${item.selectedSize}`);
            if (item.selectedColor) variants.push(`Color: ${item.selectedColor}`);
            if (item.selectedMaterial) variants.push(`Material: ${item.selectedMaterial}`);
            const variantText = variants.join(' • ');

            // Insignia roja sobre la imagen (igual a productDetails)
            const discountBadgeHtml = hasDiscount
                ? `<span class="badge bg-danger position-absolute top-0 end-0 m-1" style="font-size: 0.7rem;">-${item.discount}%</span>`
                : '';

            // Precio unitario (tachado + rojo si tiene descuento)
            const unitPriceHtml = hasDiscount
                ? `<p class="mb-0">
                       <span class="text-muted text-decoration-line-through small me-2">$${Number(item.originalPrice).toFixed(2)}</span>
                       <span class="text-danger fw-bold">$${Number(item.price).toFixed(2)}</span>
                   </p>`
                : `<p class="fw-medium text-dark-custom mb-0">$${Number(item.price).toFixed(2)}</p>`;

            // Total de la fila (cantidad * precio)
            const rowTotalHtml = hasDiscount
                ? `<div class="text-end">
                       <span class="text-muted text-decoration-line-through small me-2">$${itemOriginalTotal.toFixed(2)}</span>
                       <span class="font-heading fw-bold text-danger fs-5">$${itemTotal.toFixed(2)}</span>
                   </div>`
                : `<span class="font-heading fw-bold text-dark-custom fs-5">$${itemTotal.toFixed(2)}</span>`;

            const cardHtml = `
                <div class="cart-item-card border custom-border-light rounded-1 p-3 p-md-4 bg-white d-flex flex-column flex-sm-row gap-4 align-items-sm-center">
                    <a href="productDetails.html?id=${item.id}" class="position-relative flex-shrink-0 d-inline-block">
                        ${discountBadgeHtml}
                        <img src="${item.image}" alt="${item.name}" class="rounded-1 object-fit-cover" style="width: 100px; height: 120px;">
                    </a>

                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <div>
                                <a href="productDetails.html?id=${item.id}" class="text-decoration-none">
                                    <h3 class="font-heading fw-bold text-dark-custom fs-5 mb-1">${item.name}</h3>
                                </a>
                                ${variantText ? `<p class="text-muted-custom small mb-2">${variantText}</p>` : ''}
                                ${unitPriceHtml}
                            </div>

                            <button class="btn btn-sm text-muted-custom p-1 remove-item-btn" data-item-id="${item.itemId}" aria-label="Remove item" title="Remove">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>

                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top custom-border-light">
                            <div class="quantity-selector d-flex align-items-center">
                                <button class="qty-btn btn-qty-minus" data-item-id="${item.itemId}" aria-label="Decrease quantity">
                                    <i class="fa-solid fa-minus fs-7"></i>
                                </button>
                                <span class="qty-display fw-medium px-3">${item.quantity}</span>
                                <button class="qty-btn btn-qty-plus" data-item-id="${item.itemId}" ${item.quantity >= item.stock ? 'disabled style="opacity:0.4;"' : ''} aria-label="Increase quantity">
                                    <i class="fa-solid fa-plus fs-7"></i>
                                </button>
                            </div>

                            ${rowTotalHtml}
                        </div>
                    </div>
                </div>
            `;
            itemsContainer.innerHTML += cardHtml;
        });

        updateNavbarBadge(totalUnits);
        updateSummary(subtotal);
        attachItemEvents();
    }

    // 3. Calcular Subtotal, Envío y Total
    function updateSummary(subtotal) {
        subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

        let shippingCost = 0;
        if (subtotal >= FREE_SHIPPING_THRESHOLD) {
            shippingEl.textContent = 'FREE';
            shippingEl.classList.add('text-success');
            if (shippingNoticeEl) shippingNoticeEl.classList.add('d-none');
        } else {
            shippingCost = STANDARD_SHIPPING_COST;
            shippingEl.textContent = `$${shippingCost.toFixed(2)}`;
            shippingEl.classList.remove('text-success');
            if (shippingNoticeEl) {
                const remaining = (FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2);
                shippingNoticeEl.textContent = `Add $${remaining} more for FREE shipping!`;
                shippingNoticeEl.classList.remove('d-none');
            }
        }

        const total = subtotal + shippingCost;
        totalEl.textContent = `$${total.toFixed(2)}`;
    }

    // 4. Eventos para +, - y Eliminar
    function attachItemEvents() {
        document.querySelectorAll('.btn-qty-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = parseInt(btn.dataset.itemId);
                const item = cartItems.find(i => i.itemId === itemId);
                if (!item) return;

                if (item.quantity > 1) {
                    updateItemQuantity(itemId, item.quantity - 1);
                } else {
                    deleteCartItem(itemId);
                }
            });
        });

        document.querySelectorAll('.btn-qty-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = parseInt(btn.dataset.itemId);
                const item = cartItems.find(i => i.itemId === itemId);
                if (!item || item.quantity >= item.stock) return;

                updateItemQuantity(itemId, item.quantity + 1);
            });
        });

        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = parseInt(btn.dataset.itemId);
                deleteCartItem(itemId);
            });
        });
    }

    async function updateItemQuantity(itemId, newQuantity) {
        try {
            const response = await fetch('../backend/api/cart.php', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, quantity: newQuantity })
            });

            if (response.ok) {
                await fetchCart();
            }
        } catch (error) {
            console.error('Error actualizando cantidad:', error);
        }
    }

    async function deleteCartItem(itemId) {
        try {
            const response = await fetch(`../backend/api/cart.php?itemId=${itemId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await fetchCart();
            }
        } catch (error) {
            console.error('Error eliminando producto:', error);
        }
    }

    // 5. Botón Proceed to Checkout
// 5. Botón Proceed to Checkout (con modal de procesamiento de 3 segundos)
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async () => {
            if (!currentUser || !currentUser.id || cartItems.length === 0) return;

            checkoutBtn.disabled = true;

            // Crear cuadro modal superpuesto dinámicamente
            const overlay = document.createElement('div');
            overlay.id = 'payment-overlay';
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.55);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;

            const modalBox = document.createElement('div');
            modalBox.className = 'bg-white rounded-1 p-5 text-center shadow-lg border custom-border-light';
            modalBox.style.cssText = 'max-width: 400px; width: 90%;';
            modalBox.innerHTML = `
                <div class="spinner-border text-dark mb-3" role="status" style="width: 3rem; height: 3rem;"></div>
                <h4 class="font-heading fw-bold text-dark-custom mb-2">El pago se está procesando...</h4>
                <p class="text-muted-custom small mb-0">Por favor no cierres esta ventana.</p>
            `;

            overlay.appendChild(modalBox);
            document.body.appendChild(overlay);

            // Promesa de espera mínima de 3 segundos
            const delay3Seconds = new Promise(resolve => setTimeout(resolve, 3000));

            try {
                // Ejecutar la petición al servidor y la espera de 3 segundos en paralelo
                const [response] = await Promise.all([
                    fetch('../backend/api/checkout.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: currentUser.id })
                    }),
                    delay3Seconds
                ]);

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    // Mostrar confirmación de éxito
                    modalBox.innerHTML = `
                        <div class="text-success mb-3">
                            <i class="fa-solid fa-circle-check" style="font-size: 3.5rem;"></i>
                        </div>
                        <h4 class="font-heading fw-bold text-dark-custom mb-2">¡El pago se agendó correctamente!</h4>
                        <p class="text-muted-custom small mb-0">Orden generada con éxito.</p>
                    `;

                    // Limpiar el carrito en memoria y actualizar la vista
                    cartItems = [];
                    renderCart();

                    // Cerrar el cuadro después de 2 segundos
                    setTimeout(() => {
                        overlay.remove();
                        checkoutBtn.disabled = false;
                    }, 2000);
                } else {
                    overlay.remove();
                    checkoutBtn.disabled = false;
                    alert(result.message || 'No se pudo procesar el pago.');
                }
            } catch (error) {
                console.error('Error en checkout:', error);
                overlay.remove();
                checkoutBtn.disabled = false;
                alert('Error de conexión con el servidor al procesar el pago.');
            }
        });
    }

    // Iniciar carga
    fetchCart();
});