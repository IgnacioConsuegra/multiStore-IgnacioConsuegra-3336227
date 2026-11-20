document.addEventListener('DOMContentLoaded', () => {
    const categoriesGrid = document.getElementById('categories-grid');
    if (!categoriesGrid) return;

    fetch('backend/api/categories.php')
        .then(response => {
            if (!response.ok) throw new Error('Error al obtener las categorías');
            return response.json();
        })
        .then(categories => {
            categoriesGrid.innerHTML = '';

            categories.forEach((cat, index) => {
                const delay = index * 100;
                const itemLabel = cat.count === 1 ? 'item' : 'items';
                
                // Si tiene descuento mayor a 0, mostramos una pequeña insignia opcional
                const discountBadge = cat.discount > 0 
                    ? `<span class="badge bg-danger position-absolute top-0 end-0 m-3">-${cat.discount}%</span>` 
                    : '';

                const card = `
                    <div class="col-6 col-md-3">
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
        })
        .catch(error => {
            console.error('Error cargando categorías:', error);
        });
});