document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('featured-products-grid');
    if (!grid) return;

    function setupHorizontalCarousel(trackEl) {
        if (trackEl.parentElement.classList.contains('horizontal-carousel-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'horizontal-carousel-wrapper';
        trackEl.parentNode.insertBefore(wrapper, trackEl);
        wrapper.appendChild(trackEl);

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'carousel-nav-btn prev-btn';
        prevBtn.setAttribute('aria-label', 'Anterior');
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'carousel-nav-btn next-btn';
        nextBtn.setAttribute('aria-label', 'Siguiente');
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

        wrapper.appendChild(prevBtn);
        wrapper.appendChild(nextBtn);

        const updateButtons = () => {
            const maxScroll = trackEl.scrollWidth - trackEl.clientWidth;
            prevBtn.disabled = trackEl.scrollLeft <= 2;
            nextBtn.disabled = maxScroll <= 2 || trackEl.scrollLeft >= maxScroll - 2;
        };

        const scrollStep = () => Math.max(trackEl.clientWidth * 0.75, 260);

        prevBtn.addEventListener('click', () => {
            trackEl.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            trackEl.scrollBy({ left: scrollStep(), behavior: 'smooth' });
        });

        trackEl.addEventListener('scroll', updateButtons, { passive: true });
        window.addEventListener('resize', updateButtons);
        setTimeout(updateButtons, 100);
    }

    const renderProducts = (products) => {
        grid.innerHTML = '';

        const featured = products.filter(p => p.featured);
        const toRender = (featured.length > 0 ? featured : products).slice(0, 30);

        toRender.forEach((product, index) => {
            const delay = Math.min(index * 80, 600);
            const hasDiscount = product.discount > 0;

            const discountBadge = hasDiscount
                ? `<span class="badge bg-danger position-absolute top-0 end-0 m-3 z-2">-${product.discount}%</span>`
                : '';

            const priceHtml = hasDiscount
                ? `<p class="product-price mb-0">
                       <span class="text-muted text-decoration-line-through me-2" style="font-size: 0.85rem;">$${Number(product.originalPrice).toFixed(2)}</span>
                       <span class="text-danger fw-bold">$${Number(product.price).toFixed(2)}</span>
                   </p>`
                : `<p class="product-price mb-0">$${Number(product.price).toFixed(2)}</p>`;

            const card = `
                <div class="col-9 col-sm-6 col-lg-3 animate-slide-up" style="animation-delay: ${delay}ms;">
                    <div class="product-card position-relative">
                        ${discountBadge}
                        <a href="views/productDetails.html?id=${product.id}" class="text-decoration-none d-block">
                            <div class="product-img-wrapper">
                                <img src="${product.image}" alt="${product.name}">
                            </div>
                        </a>
                        <div class="product-info">
                            <div>
                                <h3 class="font-heading product-title">${product.name}</h3>
                                ${priceHtml}
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

        setupHorizontalCarousel(grid);
    };

    // Fetch hacia la API en PHP (ruta relativa desde index.html)
    fetch('backend/api/products.php')
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return response.json();
        })
        .then(products => {
            localStorage.setItem('currentProducts', JSON.stringify(products));
            renderProducts(products);
        })
        .catch(error => {
            console.error('Error cargando los productos desde la BD:', error);
            const cachedProducts = JSON.parse(localStorage.getItem('currentProducts'));
            if (cachedProducts) {
                renderProducts(cachedProducts);
            }
        });
});