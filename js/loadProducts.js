document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('featured-products-grid');
    if (!grid) return;

    // Función que lee del localStorage y renderiza las tarjetas
    const renderProductsFromStorage = () => {
        const storedProducts = JSON.parse(localStorage.getItem('currentProducts')) || [];
        grid.innerHTML = ''; 
        
        storedProducts.slice(0, 4).forEach((product, index) => {
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
                                <p class="product-price">$${product.price.toFixed(2)}</p>
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
    if(localStorage.getItem('currentProducts')) {
        renderProductsFromStorage();
        return;
    }
    fetch('products.json')
        .then(response => response.json())
        .then(products => {
            localStorage.setItem('currentProducts', JSON.stringify(products));
            
            renderProductsFromStorage();
        })
        .catch(error => {
            console.error('Error cargando los productos:', error);
            if(localStorage.getItem('currentProducts')) {
                renderProductsFromStorage();
            }
        });
});