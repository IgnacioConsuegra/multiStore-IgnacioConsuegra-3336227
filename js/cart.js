document.addEventListener('DOMContentLoaded', () => {
    
    const emptyState = document.getElementById('empty-cart-state');
    const populatedState = document.getElementById('populated-cart-state');
    const itemsContainer = document.getElementById('cart-items-container');
    const checkoutBtn = document.getElementById('checkout-btn');

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const user = JSON.parse(localStorage.getItem('user')) || null;

    if (!user) {
        checkoutBtn.textContent = 'Sign In to Checkout';
    }

    function syncCartWithCurrentProducts() {
        let localProducts = JSON.parse(localStorage.getItem('currentProducts')) || [];
        if (localProducts.length > 0 && cart.length > 0) {
            cart.forEach(cartItem => {
                const dbProduct = localProducts.find(p => p.id === cartItem.id);
                if (dbProduct) {
                    cartItem.stock = dbProduct.stock; 
                    if (cartItem.quantity > cartItem.stock) {
                        cartItem.quantity = cartItem.stock;
                    }
                }
            });
            
            cart = cart.filter(item => item.quantity > 0);
            localStorage.setItem('cart', JSON.stringify(cart));
        }
    }

    function renderCart() {
        syncCartWithCurrentProducts();

        if (cart.length === 0) {
            emptyState.classList.remove('d-none');
            emptyState.classList.add('d-flex');
            populatedState.classList.add('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        emptyState.classList.remove('d-flex');
        populatedState.classList.remove('d-none');

        itemsContainer.innerHTML = '';
        let subtotal = 0;

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            let propertiesHtml = '';
            if (item.selectedSize) propertiesHtml += `<span class="property-badge">Size: ${item.selectedSize}</span>`;
            if (item.selectedColor) propertiesHtml += `<span class="property-badge">Color: ${item.selectedColor}</span>`;
            if (item.selectedMaterial) propertiesHtml += `<span class="property-badge">Material: ${item.selectedMaterial}</span>`;

            itemsContainer.innerHTML += `
                <div class="cart-item-card p-4">
                    <div class="d-flex gap-4">
                        <div class="cart-item-img overflow-hidden flex-shrink-0">
                            <img src="${item.image}" alt="${item.name}" class="w-100 h-100">
                        </div>
                        <div class="flex-grow-1 min-vw-0">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <a href="/product.html?id=${item.id}" class="font-heading fs-5 fw-semibold text-dark-custom text-decoration-none">${item.name}</a>
                                    <p class="text-muted-custom small mt-1 mb-0">${item.category}</p>
                                </div>
                                <button class="btn-delete p-1" onclick="removeFromCart(${index})" aria-label="Remove item">
                                    <i class="fa-solid fa-trash-can fs-5"></i>
                                </button>
                            </div>
                            
                            <div class="d-flex flex-wrap gap-2 mb-3">
                                ${propertiesHtml}
                            </div>

                            <div class="d-flex justify-content-between align-items-end mt-auto">
                                <div class="d-flex align-items-center gap-2">
                                    <button class="qty-btn" onclick="updateQty(${index}, -1)">
                                        <i class="fa-solid fa-minus" style="font-size: 0.6rem;"></i>
                                    </button>
                                    <span class="text-dark-custom fw-medium text-center" style="width: 2rem;">${item.quantity}</span>
                                    <button class="qty-btn" onclick="updateQty(${index}, 1)" ${item.quantity >= item.stock ? 'disabled' : ''}>
                                        <i class="fa-solid fa-plus" style="font-size: 0.6rem;"></i>
                                    </button>
                                </div>
                                <div class="text-end">
                                    <p class="font-heading fs-5 fw-bold text-dark-custom mb-0">$${itemTotal.toFixed(2)}</p>
                                    <p class="text-muted-custom small mb-0">$${item.price.toFixed(2)} each</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        const shipping = subtotal >= 200 ? 0 : 15.00;
        const total = subtotal + shipping;

        document.getElementById('summary-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('summary-shipping').textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
        document.getElementById('summary-total').textContent = `$${total.toFixed(2)}`;

        window.currentOrderTotals = { subtotal, shipping, total };

        const shippingNotice = document.getElementById('shipping-notice');
        if (subtotal < 200) {
            shippingNotice.textContent = `Add $${(200 - subtotal).toFixed(2)} more for free shipping!`;
            shippingNotice.classList.remove('d-none');
        } else {
            shippingNotice.classList.add('d-none');
        }
    }

    window.removeFromCart = function(index) {
        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        renderCart();
        if(typeof initNavBar === 'function') initNavBar();
    };

    window.updateQty = function(index, change) {
        const item = cart[index];
        const newQty = item.quantity + change;
        
        if (newQty >= 1 && newQty <= item.stock) {
            item.quantity = newQty;
            localStorage.setItem('cart', JSON.stringify(cart));
            renderCart();
        }
    };

    function showSuccessOverlay() {
        const overlay = document.createElement('div');
        overlay.id = "success-overlay";
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        
        overlay.innerHTML = `
            <div style="background-color: var(--paper, #fff); padding: 3rem; border-radius: 4px; text-align: center; max-width: 400px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); animation: slideUp 0.4s ease-out;">
                <div style="width: 64px; height: 64px; background-color: #2e7d32; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto;">
                    <i class="fa-solid fa-check" style="font-size: 2rem;"></i>
                </div>
                <h2 style="font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: bold; color: var(--text-dark, #1a1a1a); margin-bottom: 1rem;">Order Confirmed!</h2>
                <p style="color: #6c757d; margin-bottom: 1.5rem; line-height: 1.5;">Thank you for your purchase. Your order has been placed successfully.</p>
                <p style="font-size: 0.875rem; color: #999;">Redirecting to your profile in <span id="redirect-countdown" style="font-weight: bold; color: var(--btn-color, #3f523e);">5</span> seconds...</p>
            </div>
        `;
        
        document.body.appendChild(overlay);

        let timeLeft = 5;
        const countdownSpan = document.getElementById('redirect-countdown');
        const interval = setInterval(() => {
            timeLeft--;
            if(countdownSpan) countdownSpan.textContent = timeLeft;
            if(timeLeft <= 0) clearInterval(interval);
        }, 1000);
    }

    checkoutBtn.addEventListener('click', async () => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Processing Order...';

        try {
            let localDB = JSON.parse(localStorage.getItem('currentProducts'));
            if (!localDB) {
                const response = await fetch('products.json');
                localDB = await response.json();
            }

            cart.forEach(cartItem => {
                const dbIndex = localDB.findIndex(p => p.id === cartItem.id);
                if (dbIndex > -1) {
                    localDB[dbIndex].stock -= cartItem.quantity;
                    if(localDB[dbIndex].stock < 0) localDB[dbIndex].stock = 0; 
                }
            });
            localStorage.setItem('currentProducts', JSON.stringify(localDB));

            const now = new Date();
            const month = now.getMonth() + 1; 
            const day = now.getDate();
            const year = now.getFullYear();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const formattedDate = `${month}/${day}/${year} ${hours}:${minutes}`;

            const newOrder = {
                orderId: 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000), 
                date: formattedDate,
                user: {
                    id: user.id || null,
                    name: user.name,
                    email: user.email
                },
                items: [...cart],
                totals: window.currentOrderTotals, 
                status: 'Pending'
            };

            let orders = JSON.parse(localStorage.getItem('orders')) || [];
            orders.push(newOrder);
            localStorage.setItem('orders', JSON.stringify(orders));

            setTimeout(() => {
                localStorage.removeItem('cart');
                cart = [];
                
                if(typeof initNavBar === 'function') initNavBar(); 

                showSuccessOverlay();
                
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 5000);

            }, 800);

        } catch (error) {
            console.error("Error processing checkout:", error);
            alert("There was an issue processing your order.");
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Proceed to Checkout';
        }
    });

    renderCart();
});