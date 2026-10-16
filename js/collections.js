document.addEventListener('DOMContentLoaded', () => {
    
    // Variables globales
    let allProducts = [];
    let filtrado = [];

    // Elementos del DOM
    const grid = document.getElementById('products-grid');
    const itemCount = document.getElementById('item-count');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');
    
    // Checkboxes de filtros
    const categoryChecks = document.querySelectorAll('.category-check');
    const sizeChecks = document.querySelectorAll('.size-check');
    const colorChecks = document.querySelectorAll('.color-check');
    const materialChecks = document.querySelectorAll('.material-check');

    // 1. Cargar datos (Priorizando el localStorage para respetar cambios de stock/admin)
    function loadData() {
        const localDB = JSON.parse(localStorage.getItem('currentProducts'));
        
        if (localDB && localDB.length > 0) {
            allProducts = localDB;
            applyFilters();
        } else {
            fetch('products.json')
                .then(response => response.json())
                .then(data => {
                    allProducts = data;
                    localStorage.setItem('currentProducts', JSON.stringify(data));
                    applyFilters();
                })
                .catch(error => console.error("Error cargando productos:", error));
        }
    }

    // 2. Lógica Principal de Filtrado
    function applyFilters() {
        filtrado = [...allProducts]; // Copia fresca del array original

        // A. Filtro por Búsqueda (Nombre, Descripción, Categoría)
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm) {
            filtrado = filtrado.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                (p.description && p.description.toLowerCase().includes(searchTerm)) ||
                (p.category && p.category.toLowerCase().includes(searchTerm))
            );
        }

        // B. Filtros por Checkboxes (Arrays de valores seleccionados)
        const getCheckedValues = (nodeList) => Array.from(nodeList).filter(cb => cb.checked).map(cb => cb.value);
        
        const activeCategories = getCheckedValues(categoryChecks);
        const activeSizes = getCheckedValues(sizeChecks);
        const activeColors = getCheckedValues(colorChecks);
        const activeMaterials = getCheckedValues(materialChecks);

        // Aplicar Categorías
        if (activeCategories.length > 0) {
            filtrado = filtrado.filter(p => activeCategories.includes(p.category));
        }

        // Aplicar Tallas (El producto debe tener al menos una de las tallas seleccionadas)
        if (activeSizes.length > 0) {
            filtrado = filtrado.filter(p => p.sizes && p.sizes.some(size => activeSizes.includes(size)));
        }

        // Aplicar Colores
        if (activeColors.length > 0) {
            filtrado = filtrado.filter(p => p.colors && p.colors.some(color => activeColors.includes(color)));
        }

        // Aplicar Materiales
        if (activeMaterials.length > 0) {
            filtrado = filtrado.filter(p => p.materials && p.materials.some(material => activeMaterials.includes(material)));
        }

        // C. Filtro por Precio
        const minP = parseFloat(priceMin.value) || 0;
        const maxP = parseFloat(priceMax.value) || Infinity;
        filtrado = filtrado.filter(p => p.price >= minP && p.price <= maxP);

        // D. Ordenamiento (Sort)
        const sortValue = sortSelect.value;
        if (sortValue === 'price-low') {
            filtrado.sort((a, b) => a.price - b.price);
        } else if (sortValue === 'price-high') {
            filtrado.sort((a, b) => b.price - a.price);
        } else if (sortValue === 'name') {
            filtrado.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortValue === 'rating') {
            filtrado.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }

        // E. Renderizar Resultados
        renderProducts(filtrado);
    }

    // 3. Renderizar las tarjetas
    function renderProducts(productsToRender) {
        grid.innerHTML = '';
        itemCount.textContent = productsToRender.length;

        if (productsToRender.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fa-solid fa-box-open fs-1 text-muted opacity-25 mb-3"></i>
                    <h3 class="font-heading fw-bold text-dark-custom">No products found</h3>
                    <p class="text-muted-custom">Try adjusting your filters or search term.</p>
                </div>
            `;
            return;
        }

        productsToRender.forEach((product, index) => {
            // Se añade un pequeño retraso de animación en cascada
            const delay = (index % 12) * 50; 
            
            // Etiqueta condicional de stock
            const stockBadge = product.stock <= 0 
                ? `<span class="position-absolute top-0 start-0 m-3 badge bg-danger rounded-1">Out of Stock</span>`
                : '';

            const card = `
                <div class="col-12 col-sm-6 col-lg-3" style="animation: fadeIn 0.4s ease-out ${delay}ms forwards; opacity: 0;">
                    <div class="card h-100 border-0 rounded-1 shadow-sm overflow-hidden product-card-hover">
                        <a href="./productDetails.html?id=${product.id}" class="text-decoration-none d-block position-relative">
                            ${stockBadge}
                            <div class="bg-light" style="height: 300px;">
                                <img src="${product.image}" alt="${product.name}" class="w-100 h-100 object-fit-cover">
                            </div>
                        </a>
                        <div class="card-body d-flex flex-column justify-content-between p-3">
                            <div>
                                <p class="text-muted small mb-1">${product.category || 'Product'}</p>
                                <a href="./productDetails.html?id=${product.id}" class="text-decoration-none">
                                    <h3 class="font-heading fs-6 fw-bold text-dark-custom mb-2 text-truncate">${product.name}</h3>
                                </a>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-3">
                                <p class="fw-medium text-dark-custom mb-0">$${product.price.toFixed(2)}</p>
                                <button class="btn btn-sm btn-outline-dark rounded-1" onclick="window.location.href='./productDetails.html?id=${product.id}'">
                                    View Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            grid.innerHTML += card;
        });
    }

    // 4. Asignar Event Listeners a los controles
    searchInput.addEventListener('input', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    priceMin.addEventListener('input', applyFilters);
    priceMax.addEventListener('input', applyFilters);

    document.querySelectorAll('.filter-check').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });

    // Añadir estilo CSS de animación dinámicamente si no existe
    if (!document.getElementById('collections-animations')) {
        const style = document.createElement('style');
        style.id = 'collections-animations';
        style.innerHTML = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .product-card-hover { transition: transform 0.2s, box-shadow 0.2s; }
            .product-card-hover:hover { transform: translateY(-4px); box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important; }
        `;
        document.head.appendChild(style);
    }

    // Inicializar
    loadData();
});