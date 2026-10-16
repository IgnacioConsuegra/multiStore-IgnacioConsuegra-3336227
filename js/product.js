document.addEventListener('DOMContentLoaded', () => {
    let currentProduct = null;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId) {
        let localProducts = JSON.parse(localStorage.getItem('currentProducts'));

        if (localProducts && localProducts.length > 0) {
            loadProduct(localProducts);
        } else {
            fetch('products.json')
                .then(response => response.json())
                .then(products => {
                    localStorage.setItem('currentProducts', JSON.stringify(products));
                    loadProduct(products);
                })
                .catch(error => console.error('Error buscando el producto:', error));
        }
    } else {
        window.location.href = 'not-found.html';
    }

    function loadProduct(products) {
        const product = products.find(p => p.id === productId);
        
        if (product) {
            currentProduct = product; 

            document.getElementById('prod-name').textContent = product.name;
            document.getElementById('prod-price').textContent = `$${product.price.toFixed(2)}`;
            document.getElementById('prod-desc').textContent = product.description;
            document.getElementById('prod-img').src = product.image;
            document.getElementById('prod-img').alt = product.name;
            
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
                        `<button class="property-btn ${index === 0 ? 'active' : ''}">${option}</button>`
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
                button.addEventListener('click', function() {
                    const siblings = this.parentElement.querySelectorAll('.property-btn');
                    siblings.forEach(sib => sib.classList.remove('active'));
                    this.classList.add('active');
                });
            });

        } else {
            window.location.href = 'not-found.html';
        }
    }

    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    const qtyValue = document.getElementById('qty-value');
    
    let quantity = 1;

    if(btnMinus && btnPlus) {
        btnMinus.addEventListener('click', () => {
            if (quantity > 1) {
                quantity--;
                qtyValue.textContent = quantity;
            }
        });

        btnPlus.addEventListener('click', () => {
            if(currentProduct && quantity < currentProduct.stock) {
                quantity++;
                qtyValue.textContent = quantity;
            }
        });
    }

    const btnAddCart = document.querySelector('.btn-add-cart');
    const successMsg = document.getElementById('success-msg');

    if(btnAddCart) {
        btnAddCart.addEventListener('click', () => {
            if(!btnAddCart.disabled && currentProduct) {
                
                const activeSize = document.querySelector('#prop-container-sizes .property-btn.active');
                const activeColor = document.querySelector('#prop-container-colors .property-btn.active');
                const activeMaterial = document.querySelector('#prop-container-materials .property-btn.active');
                
                const selectedSize = activeSize ? activeSize.textContent : null;
                const selectedColor = activeColor ? activeColor.textContent : null;
                const selectedMaterial = activeMaterial ? activeMaterial.textContent : null;
                
                const qty = parseInt(document.getElementById('qty-value').textContent);

                let cart = JSON.parse(localStorage.getItem('cart')) || [];

                const existingItemIndex = cart.findIndex(item => 
                    item.id === currentProduct.id && 
                    item.selectedSize === selectedSize && 
                    item.selectedColor === selectedColor &&
                    item.selectedMaterial === selectedMaterial
                );

                if (existingItemIndex > -1) {
                    const newQty = cart[existingItemIndex].quantity + qty;
                    cart[existingItemIndex].quantity = Math.min(newQty, currentProduct.stock);
                } else {
                    cart.push({
                        id: currentProduct.id,
                        name: currentProduct.name,
                        price: currentProduct.price,
                        image: currentProduct.image,
                        category: currentProduct.category || 'Product',
                        selectedSize: selectedSize,
                        selectedColor: selectedColor,
                        selectedMaterial: selectedMaterial,
                        quantity: qty
                    });
                }

                localStorage.setItem('cart', JSON.stringify(cart));
                
                if(typeof initNavBar === 'function') initNavBar();

                successMsg.classList.remove('d-none');
                setTimeout(() => {
                    successMsg.classList.add('d-none');
                }, 3000);
            }
        });
    }
});