let searchResults = { inventario: [], sonepar: [] };

document.getElementById('searchBtn').addEventListener('click', async () => {
    const text = document.getElementById('refInput').value;
    const references = text.split('\n').map(r => r.trim()).filter(r => r !== "");

    if (references.length === 0) {
        alert("Por favor, introduce al menos una referencia.");
        return;
    }

    const btn = document.getElementById('searchBtn');
    btn.textContent = "Buscando...";
    btn.disabled = true;
    document.body.classList.add('loading');

    try {
        const response = await fetch('http://localhost:5000/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ references })
        });

        if (!response.ok) throw new Error('Error en la búsqueda');

        searchResults = await response.json();
        renderTables();
        document.getElementById('exportBtn').disabled = false;
    } catch (error) {
        console.error(error);
        alert("Ocurrió un error al conectar con el servidor.");
    } finally {
        btn.textContent = "Buscar Referencias";
        btn.disabled = false;
        document.body.classList.remove('loading');
    }
});

function renderTables() {
    const invTableBody = document.querySelector('#invTable tbody');
    const sonTableBody = document.querySelector('#sonTable tbody');

    invTableBody.innerHTML = searchResults.inventario.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td>${item.Ubicacion || '-'}</td>
            <td>${item.Cantidad}</td>
        </tr>
    `).join('');

    sonTableBody.innerHTML = searchResults.sonepar.map(item => `
        <tr>
            <td>${item.Referencia}</td>
            <td>${item.Empresa || '-'}</td>
            <td>${item.Cantidad}</td>
        </tr>
    `).join('');

    if (searchResults.inventario.length === 0 && searchResults.sonepar.length === 0) {
        invTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No se encontraron resultados</td></tr>';
        sonTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No se encontraron resultados</td></tr>';
    }
}

document.getElementById('exportBtn').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();

    // Hoja Inventario
    if (searchResults.inventario.length > 0) {
        const wsInv = XLSX.utils.json_to_sheet(searchResults.inventario);
        XLSX.utils.book_append_sheet(wb, wsInv, "Inventario Cerdanya");
    }

    // Hoja Sonepar
    if (searchResults.sonepar.length > 0) {
        const wsSon = XLSX.utils.json_to_sheet(searchResults.sonepar);
        XLSX.utils.book_append_sheet(wb, wsSon, "Stock Sonepar");
    }

    if (searchResults.inventario.length === 0 && searchResults.sonepar.length === 0) {
        alert("No hay resultados para exportar");
        return;
    }

    XLSX.writeFile(wb, "Findly_Resultados.xlsx");
});
