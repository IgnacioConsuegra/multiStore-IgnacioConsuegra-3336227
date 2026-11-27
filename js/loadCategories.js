document.addEventListener('DOMContentLoaded', () => {
    const categoriesGrid = document.getElementById('categories-grid');
    if (!categoriesGrid) return;

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

        const scrollStep = () => Math.max(trackEl.clientWidth * 0.75, 220);

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

    fetch('backend/api/categories.php')
        .then(response => {
            if (!response.ok) throw new Error('Error al obtener las categorías');
            return response.json();
        })
        .then(categories => {
            categoriesGrid.innerHTML = '';

            categories.forEach((cat, index) => {
                const delay = Math.min(index * 80, 600);
                const itemLabel = cat.count === 1 ? 'item' : 'items';

                const discountBadge = cat.discount > 0
                    ? `<span class="badge bg-danger position-absolute top-0 end-0 m-3">-${cat.discount}%</span>`
                    : '';

                const card = `
                    <div class="col-6 col-sm-4 col-md-3">
                        <a href="views/collections.html?category=${encodeURIComponent(cat.name)}" 
                           class="category-card d-block text-decoration-none h-100 position-relative"
                           style="animation-delay: ${delay}ms;">
                            <div class="card-dec-circle"></div>
                            ${discountBadge}

                            <div class="position-relative z-1">
                                <div class="card-icon-wrapper">
                                    <i class="${cat.icon}"></i>
                                </div>
                                <h3 class="font-heading card-title">${cat.name}</h3>
                                <p class="card-count">${cat.count} ${itemLabel}</p>
                            </div>
                        </a>
                    </div>
                `;
                categoriesGrid.innerHTML += card;
            });

            setupHorizontalCarousel(categoriesGrid);
        })
        .catch(error => {
            console.error('Error cargando categorías:', error);
        });
});