document.addEventListener('DOMContentLoaded', () => {
    let currentProduct = null;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        window.location.href = 'not-found.html';
        return;
    }

    // 1. Consultar directamente el producto en MySQL a través de la API PHP
    fetch(`../backend/api/products.php?id=${encodeURIComponent(productId)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Producto no encontrado');
            }
            return response.json();
        })
        .then(product => {
            if (product && product.id) {
                renderProductDetails(product);
            } else {
                window.location.href = 'not-found.html';
            }
        })
        .catch(error => {
            console.error('Error cargando detalle del producto:', error);
            window.location.href = 'not-found.html';
        });

    function renderProductDetails(product) {
        currentProduct = product;

        // Nombre, descripción e imagen
        document.getElementById('prod-name').textContent = product.name;
        document.getElementById('prod-desc').textContent = product.description;
        document.getElementById('prod-img').src = product.image;
        document.getElementById('prod-img').alt = product.name;

        // Precio y porcentaje de descuento de la colección
        const priceEl = document.getElementById('prod-price');
        const discountBadge = document.getElementById('prod-discount-badge');

        if (product.discount > 0) {
            if (discountBadge) {
                discountBadge.textContent = `-${product.discount}%`;
                discountBadge.classList.remove('d-none');
            }

            priceEl.innerHTML = `
                <span class="text-muted text-decoration-line-through fs-4 me-2">$${Number(product.originalPrice).toFixed(2)}</span>
                <span class="text-danger">$${Number(product.price).toFixed(2)}</span>
            `;
        } else {
            if (discountBadge) discountBadge.classList.add('d-none');
            priceEl.textContent = `$${Number(product.price).toFixed(2)}`;
        }

        // Botones pequeños en gris con las colecciones debajo de la descripción (ignorando 'All')
        const categoriesContainer = document.getElementById('prod-categories');
        if (categoriesContainer && Array.isArray(product.categories)) {
            const visibleCategories = product.categories.filter(cat => cat.toLowerCase() !== 'all');

            categoriesContainer.innerHTML = visibleCategories.map(cat => `
                <a href="collections.html?category=${encodeURIComponent(cat)}" 
                   class="btn btn-sm btn-secondary bg-secondary-subtle text-secondary border-0 rounded-1 px-2 py-1"
                   style="font-size: 0.75rem;">
                    ${cat}
                </a>
            `).join('');
        }

        // Control de Stock
        const stockLabel = document.getElementById('prod-stock');
        const addToCartBtn = document.querySelector('.btn-add-cart');

        if (product.stock > 0) {
            stockLabel.textContent = `(${product.stock} in stock)`;
        } else {
            stockLabel.textContent = "(Out of stock)";
            stockLabel.classList.replace('text-muted-custom', 'text-danger');
            addToCartBtn.disabled = true;
            addToCartBtn.style.opacity = '0.5';
            addToCartBtn.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Out of Stock';
        }

        // Propiedades (Tallas, Colores, Materiales)
        const propertiesContainer = document.getElementById('prod-properties');
        propertiesContainer.innerHTML = '';

        const propertyTypes = [
            { key: 'sizes', label: 'SIZES' },
            { key: 'colors', label: 'COLOR' },
            { key: 'materials', label: 'MATERIAL' }
        ];

        propertyTypes.forEach(propType => {
            if (product[propType.key] && product[propType.key].length > 0) {
                const optionsHtml = product[propType.key].map((option, index) =>
                    `<button type="button" class="property-btn ${index === 0 ? 'active' : ''}">${option}</button>`
                ).join('');

                propertiesContainer.innerHTML += `
                    <div id="prop-container-${propType.key}">
                        <h3 class="property-label">${propType.label}</h3>
                        <div class="d-flex gap-2 flex-wrap">
                            ${optionsHtml}
                        </div>
                    </div>
                `;
            }
        });

        const propertyButtons = document.querySelectorAll('.property-btn');
        propertyButtons.forEach(button => {
            button.addEventListener('click', function () {
                const siblings = this.parentElement.querySelectorAll('.property-btn');
                siblings.forEach(sib => sib.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }

    // 2. Selector de cantidad
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    const qtyValue = document.getElementById('qty-value');

    let quantity = 1;

    if (btnMinus && btnPlus) {
        btnMinus.addEventListener('click', () => {
            if (quantity > 1) {
                quantity--;
                qtyValue.textContent = quantity;
            }
        });

        btnPlus.addEventListener('click', () => {
            if (currentProduct && quantity < currentProduct.stock) {
                quantity++;
                qtyValue.textContent = quantity;
            }
        });
    }

    // 3. Agregar al carrito en MySQL
    const btnAddCart = document.querySelector('.btn-add-cart');
    const successMsg = document.getElementById('success-msg');

    if (btnAddCart) {
        btnAddCart.addEventListener('click', async () => {
            if (btnAddCart.disabled || !currentProduct) return;

            // Verificar que el usuario haya iniciado sesión
            const currentUser = JSON.parse(localStorage.getItem('user'));
            if (!currentUser || !currentUser.id) {
                alert('Please sign in to add items to your cart.');
                window.location.href = 'login.html';
                return;
            }

            const activeSize = document.querySelector('#prop-container-sizes .property-btn.active');
            const activeColor = document.querySelector('#prop-container-colors .property-btn.active');
            const activeMaterial = document.querySelector('#prop-container-materials .property-btn.active');

            const attributes = {};
            if (activeSize) attributes.Size = activeSize.textContent.trim();
            if (activeColor) attributes.Color = activeColor.textContent.trim();
            if (activeMaterial) attributes.Material = activeMaterial.textContent.trim();

            const qty = parseInt(document.getElementById('qty-value').textContent) || 1;

            const payload = {
                userId: currentUser.id,
                productId: currentProduct.id,
                quantity: qty,
                price: currentProduct.price,
                image: currentProduct.image,
                attributes: attributes
            };

            const originalBtnHtml = btnAddCart.innerHTML;
            btnAddCart.disabled = true;
            btnAddCart.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

            try {
                const response = await fetch('../backend/api/cart.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    // Actualizar el badge numérico del carrito en el navbar
                    const cartBadges = document.querySelectorAll('.cart-badge, #cart-count');
                    cartBadges.forEach(badge => {
                        badge.textContent = result.cartCount;
                        badge.classList.remove('d-none');
                    });

                    successMsg.classList.remove('d-none');
                    setTimeout(() => {
                        successMsg.classList.add('d-none');
                    }, 3000);
                } else {
                    alert(result.message || 'Could not add product to cart.');
                }
            } catch (error) {
                console.error('Error al agregar al carrito:', error);
                alert('Server connection error.');
            } finally {
                btnAddCart.disabled = false;
                btnAddCart.innerHTML = originalBtnHtml;
            }
        });
    }
});