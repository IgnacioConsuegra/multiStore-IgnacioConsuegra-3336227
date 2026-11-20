document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('featured-products-grid');
    if (!grid) return;

    const renderProducts = (products) => {
        grid.innerHTML = ''; 
        
        // Filtrar destacados si existen, o tomar los primeros 4
        const featured = products.filter(p => p.featured);
        const toRender = (featured.length > 0 ? featured : products).slice(0, 4);

        toRender.forEach((product, index) => {
            const delay = index * 100;
            const card = `
                <div class="col-12 col-sm-6 col-lg-3 animate-slide-up" style="animation-delay: ${delay}ms;">
                    <div class="product-card">
                        <a href="views/productDetails.html?id=${product.id}" class="text-decoration-none d-block">
                            <div class="product-img-wrapper">
                                <img src="${product.image}" alt="${product.name}">
                            </div>
                        </a>
                        <div class="product-info">
                            <div>
                                <h3 class="font-heading product-title">${product.name}</h3>
                                <p class="product-price">$${Number(product.price).toFixed(2)}</p>
                            </div>
                            <button class="cart-btn" onclick="addToCart('${product.id}')" aria-label="Add to cart">
                                <i class="fa-solid fa-cart-shopping"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            grid.innerHTML += card;
        });
    };

    // Fetch hacia la API en PHP (ruta relativa desde index.html)
    fetch('backend/api/products.php')
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return response.json();
        })
        .then(products => {
            // Sincronizamos con localStorage para que addToCart siga encontrando el producto
            localStorage.setItem('currentProducts', JSON.stringify(products));
            renderProducts(products);
        })
        .catch(error => {
            console.error('Error cargando los productos desde la BD:', error);
            // Respaldo con caché local si falla la red
            const cachedProducts = JSON.parse(localStorage.getItem('currentProducts'));
            if (cachedProducts) {
                renderProducts(cachedProducts);
            }
        });
});