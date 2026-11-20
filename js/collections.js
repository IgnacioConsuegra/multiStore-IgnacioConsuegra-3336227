document.addEventListener('DOMContentLoaded', async () => {
    // Referencias del DOM
    const productsGrid = document.getElementById('products-grid');
    const itemCount = document.getElementById('item-count');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const priceMinInput = document.getElementById('price-min');
    const priceMaxInput = document.getElementById('price-max');

    const categoryContainer = document.getElementById('filter-category');
    const sizeContainer = document.getElementById('filter-size');
    const colorContainer = document.getElementById('filter-color');
    const materialContainer = document.getElementById('filter-material');

    let allProducts = [];
    let allCategories = [];

    // 1. Leer parámetro ?category=... de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category');

    // 2. Cargar productos y categorías desde el Backend PHP en paralelo
    try {
        const [productsRes, categoriesRes] = await Promise.all([
            fetch('../backend/api/products.php'),
            fetch('../backend/api/categories.php')
        ]);

        if (!productsRes.ok || !categoriesRes.ok) {
            throw new Error('Error al consultar la API');
        }

        allProducts = await productsRes.json();
        allCategories = await categoriesRes.json();

        // Sincronizar con localStorage para que el carrito siga funcionando
        localStorage.setItem('currentProducts', JSON.stringify(allProducts));

        // 3. Construir checkboxes dinámicos desde la BD
        renderFilterOptions();

        // 4. Si viene una categoría en la URL (y no es "All"), marcar su checkbox
        if (categoryFromUrl && categoryFromUrl.toLowerCase() !== 'all') {
            const checkboxes = document.querySelectorAll('.category-check');
            checkboxes.forEach(cb => {
                if (cb.value.toLowerCase() === categoryFromUrl.toLowerCase()) {
                    cb.checked = true;
                }
            });
        }

        // 5. Aplicar filtros iniciales y renderizar
        applyFiltersAndSort();

    } catch (error) {
        console.error('Error inicializando la colección:', error);
        productsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <p class="text-danger">Error loading products from the database.</p>
            </div>
        `;
    }

    // Genera los checkboxes de Categorías, Tallas, Colores y Materiales desde los datos reales
    function renderFilterOptions() {
        // Categorías (omitimos "All" porque desmarcar todo ya muestra todos los productos)
        const validCategories = allCategories.filter(c => c.name.toLowerCase() !== 'all');
        categoryContainer.innerHTML = validCategories.map(cat => `
            <label class="custom-checkbox d-flex align-items-center gap-2">
                <input type="checkbox" value="${cat.name}" class="filter-check category-check">
                <span>${cat.name}</span>
            </label>
        `).join('');

        // Extraer valores únicos de tallas, colores y materiales de los productos cargados
        const uniqueSizes = [...new Set(allProducts.flatMap(p => p.sizes || []))];
        const uniqueColors = [...new Set(allProducts.flatMap(p => p.colors || []))];
        const uniqueMaterials = [...new Set(allProducts.flatMap(p => p.materials || []))];

        sizeContainer.innerHTML = uniqueSizes.map(size => `
            <label class="custom-checkbox d-flex align-items-center gap-2">
                <input type="checkbox" value="${size}" class="filter-check size-check">
                <span>${size}</span>
            </label>
        `).join('');

        colorContainer.innerHTML = uniqueColors.map(color => `
            <label class="custom-checkbox d-flex align-items-center gap-2">
                <input type="checkbox" value="${color}" class="filter-check color-check">
                <span>${color}</span>
            </label>
        `).join('');

        materialContainer.innerHTML = uniqueMaterials.map(mat => `
            <label class="custom-checkbox d-flex align-items-center gap-2">
                <input type="checkbox" value="${mat}" class="filter-check material-check">
                <span>${mat}</span>
            </label>
        `).join('');

        // Escuchar cambios en todos los checkboxes recién creados
        document.querySelectorAll('.filter-check').forEach(checkbox => {
            checkbox.addEventListener('change', applyFiltersAndSort);
        });
    }

    // Filtra y ordena el arreglo de productos
   // Filtra y ordena el arreglo de productos
    function applyFiltersAndSort() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const sortBy = sortSelect.value;
        const minPrice = parseFloat(priceMinInput.value) || 0;
        const maxPrice = priceMaxInput.value === '' ? Infinity : parseFloat(priceMaxInput.value);

        const selectedCategories = getCheckedValues('.category-check');
        const selectedSizes = getCheckedValues('.size-check');
        const selectedColors = getCheckedValues('.color-check');
        const selectedMaterials = getCheckedValues('.material-check');

        let filtered = allProducts.filter(product => {
            // 1. Filtro de búsqueda por texto
            const matchesSearch = !searchTerm ||
                product.name.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm)) ||
                (product.categories && product.categories.some(c => c.toLowerCase().includes(searchTerm)));

            // 2. Filtro de categorías
            const matchesCategory = selectedCategories.length === 0 ||
                (product.categories && product.categories.some(c => selectedCategories.includes(c)));

            // 3. Filtro de tallas
            const matchesSize = selectedSizes.length === 0 ||
                (product.sizes && product.sizes.some(s => selectedSizes.includes(s)));

            // 4. Filtro de colores
            const matchesColor = selectedColors.length === 0 ||
                (product.colors && product.colors.some(c => selectedColors.includes(c)));

            // 5. Filtro de materiales
            const matchesMaterial = selectedMaterials.length === 0 ||
                (product.materials && product.materials.some(m => selectedMaterials.includes(m)));

            // 6. Filtro de rango de precio
            const price = Number(product.price);
            const matchesPrice = price >= minPrice && price <= maxPrice;

            // 7. Filtro de Sale (solo productos con descuento > 0 si está seleccionada la opción)
            const matchesSale = sortBy !== 'sale' || Number(product.discount) > 0;

            return matchesSearch && matchesCategory && matchesSize && matchesColor && matchesMaterial && matchesPrice && matchesSale;
        });

        // Ordenamiento
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'sale':
                    // Ordena de mayor a menor porcentaje de descuento
                    return Number(b.discount) - Number(a.discount);
                case 'price-low':
                    return Number(a.price) - Number(b.price);
                case 'price-high':
                    return Number(b.price) - Number(a.price);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'rating':
                    return (b.rating || 5) - (a.rating || 5);
                case 'featured':
                default:
                    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
            }
        });

        renderProducts(filtered);
    }

    function getCheckedValues(selector) {
        return Array.from(document.querySelectorAll(`${selector}:checked`)).map(cb => cb.value);
    }

    // Renderiza las tarjetas de productos en el grid
    function renderProducts(products) {
        itemCount.textContent = products.length;
        productsGrid.innerHTML = '';

        if (products.length === 0) {
            productsGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h4 class="font-heading text-muted-custom">No pieces found matching your criteria.</h4>
                    <p class="text-muted-custom">Try adjusting your filters or search terms.</p>
                </div>
            `;
            return;
        }

        products.forEach((product, index) => {
            const delay = (index % 4) * 100;
            const isOutOfStock = product.stock <= 0;
            const hasDiscount = product.discount > 0;
            const categoriesLabel = (product.categories || []).join(' • ');

            // Insignia izquierda: Sin stock
            const stockBadge = isOutOfStock
                ? `<span class="badge bg-secondary position-absolute top-0 start-0 m-3 z-2">Out of Stock</span>`
                : '';

            // Insignia derecha: Mayor descuento de sus categorías
            const discountBadge = hasDiscount
                ? `<span class="badge bg-danger position-absolute top-0 end-0 m-3 z-2">-${product.discount}%</span>`
                : '';

            // Bloque de precio (tachado + rebajado si hay descuento)
            const priceHtml = hasDiscount
                ? `<p class="product-price mb-0">
                       <span class="text-muted text-decoration-line-through me-2" style="font-size: 0.85rem;">$${Number(product.originalPrice).toFixed(2)}</span>
                       <span class="text-danger fw-bold">$${Number(product.price).toFixed(2)}</span>
                   </p>`
                : `<p class="product-price mb-0">$${Number(product.price).toFixed(2)}</p>`;

            const card = `
                <div class="col-12 col-sm-6 col-lg-3 animate-slide-up" style="animation-delay: ${delay}ms;">
                    <div class="product-card position-relative">
                        ${stockBadge}
                        ${discountBadge}
                        <a href="productDetails.html?id=${product.id}" class="text-decoration-none d-block">
                            <div class="product-img-wrapper">
                                <img src="${product.image}" alt="${product.name}">
                            </div>
                        </a>
                        <div class="product-info">
                            <div>
                                <small class="text-muted d-block mb-1" style="font-size: 0.75rem;">${categoriesLabel}</small>
                                <h3 class="font-heading product-title">${product.name}</h3>
                                ${priceHtml}
                            </div>
                            <button class="cart-btn" 
                                    onclick="addToCart('${product.id}')" 
                                    ${isOutOfStock ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                                    aria-label="Add to cart">
                                <i class="fa-solid fa-cart-shopping"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            productsGrid.innerHTML += card;
        });
    }

    // Eventos para barra de búsqueda, ordenamiento y precios
    searchInput.addEventListener('input', applyFiltersAndSort);
    sortSelect.addEventListener('change', applyFiltersAndSort);
    priceMinInput.addEventListener('input', applyFiltersAndSort);
    priceMaxInput.addEventListener('input', applyFiltersAndSort);
});