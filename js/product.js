document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica de Cantidad ---
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    const qtyValue = document.getElementById('qty-value');
    
    let quantity = 1;

    btnMinus.addEventListener('click', () => {
        if (quantity > 1) {
            quantity--;
            qtyValue.textContent = quantity;
        }
    });

    btnPlus.addEventListener('click', () => {
        quantity++;
        qtyValue.textContent = quantity;
    });

    // --- Lógica de Selección de Propiedades ---
    const propertyButtons = document.querySelectorAll('.property-btn');
    
    propertyButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Encuentra a los hermanos dentro del mismo contenedor y quita la clase active
            const siblings = this.parentElement.querySelectorAll('.property-btn');
            siblings.forEach(sib => sib.classList.remove('active'));
            
            // Añade la clase active al botón clicado
            this.classList.add('active');
        });
    });

    // --- Lógica Añadir al Carrito ---
    const btnAddCart = document.querySelector('.btn-add-cart');
    const successMsg = document.getElementById('success-msg');

    btnAddCart.addEventListener('click', () => {
        // Muestra el mensaje de éxito
        successMsg.classList.remove('d-none');
        
        // Oculta el mensaje después de 3 segundos
        setTimeout(() => {
            successMsg.classList.add('d-none');
        }, 3000);
    });
});


document.addEventListener('DOMContentLoaded', () => {
    // 1. Obtener el ID de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (productId) {
        // 2. Buscar el producto en el JSON
        fetch('../products.json')
            .then(response => response.json())
            .then(products => {
                const product = products.find(p => p.id === productId);
                
                if (product) {
                    // 3. Inyectar la información básica en el DOM
                    document.getElementById('prod-name').textContent = product.name;
                    document.getElementById('prod-price').textContent = `$${product.price.toFixed(2)}`;
                    document.getElementById('prod-desc').textContent = product.description;
                    document.getElementById('prod-img').src = product.image;
                    document.getElementById('prod-img').alt = product.name;
                    
                    const stockLabel = document.getElementById('prod-stock');
                    const addToCartBtn = document.querySelector('.btn-add-cart');

                    // Manejo del Stock
                    if (product.stock > 0) {
                        stockLabel.textContent = `(${product.stock} in stock)`;
                    } else {
                        stockLabel.textContent = "(Out of stock)";
                        stockLabel.classList.replace('text-muted-custom', 'text-danger');
                        addToCartBtn.disabled = true;
                        addToCartBtn.style.opacity = '0.5';
                        addToCartBtn.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Out of Stock';
                    }

                    // 4. Lógica DINÁMICA de Propiedades
                    const propertiesContainer = document.getElementById('prod-properties');
                    propertiesContainer.innerHTML = ''; // Limpiar por seguridad

                    // Definimos qué propiedades vamos a buscar en el JSON
                    const propertyTypes = [
                        { key: 'sizes', label: 'SIZES' },
                        { key: 'colors', label: 'COLOR' },
                        { key: 'materials', label: 'MATERIAL' }
                    ];

                    propertyTypes.forEach(propType => {
                        // Verificamos si el producto tiene esta propiedad y si el arreglo tiene elementos
                        if (product[propType.key] && product[propType.key].length > 0) {
                            
                            // Creamos los botones para cada opción
                            const optionsHtml = product[propType.key].map((option, index) => 
                                `<button class="property-btn ${index === 0 ? 'active' : ''}">${option}</button>`
                            ).join('');

                            // Inyectamos el bloque completo de la propiedad
                            propertiesContainer.innerHTML += `
                                <div>
                                    <h3 class="property-label">${propType.label}</h3>
                                    <div class="d-flex gap-2 flex-wrap">
                                        ${optionsHtml}
                                    </div>
                                </div>
                            `;
                        }
                    });

                    // Reactivar la lógica de selección (clase 'active') para los botones recién creados
                    const propertyButtons = document.querySelectorAll('.property-btn');
                    propertyButtons.forEach(button => {
                        button.addEventListener('click', function() {
                            const siblings = this.parentElement.querySelectorAll('.property-btn');
                            siblings.forEach(sib => sib.classList.remove('active'));
                            this.classList.add('active');
                        });
                    });

                } else {
                    window.location.href = 'productNotFound.html';
                }
            })
            .catch(error => console.error('Error buscando el producto:', error));
    } else {
        window.location.href = 'not-found.html';
    }

    // --- Lógica de Cantidad (Se mantiene igual) ---
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
            quantity++;
            qtyValue.textContent = quantity;
        });
    }

    // --- Lógica Añadir al Carrito (Se mantiene igual) ---
    const btnAddCart = document.querySelector('.btn-add-cart');
    const successMsg = document.getElementById('success-msg');

    if(btnAddCart) {
        btnAddCart.addEventListener('click', () => {
            if(!btnAddCart.disabled) {
                successMsg.classList.remove('d-none');
                setTimeout(() => {
                    successMsg.classList.add('d-none');
                }, 3000);
            }
        });
    }
});