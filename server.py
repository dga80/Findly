import os
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Rutas de los archivos de Excel
PATH_INVENTARIO = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\INVENTARIO Cerdanya (NUEVO).xlsx"
PATH_SONEPAR = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\STOCK SCHNEIDER-SONEPAR 26.xlsx"

def read_inventario():
    try:
        # Col A = Ubicación (index 0), Col B = Referencia (index 1), Col E = Cantidad (index 4)
        df = pd.read_excel(PATH_INVENTARIO, usecols=[0, 1, 4])
        df.columns = ['Ubicacion', 'Referencia', 'Cantidad']
        return df.dropna(subset=['Referencia'])
    except Exception as e:
        print(f"Error reading Inventario: {e}")
        return pd.DataFrame(columns=['Ubicacion', 'Referencia', 'Cantidad'])

def read_sonepar():
    try:
        # Col B = Referencia (index 1), Col Q = Empresa (index 16), Col AE = Cantidad (index 30)
        df = pd.read_excel(PATH_SONEPAR, usecols=[1, 16, 30])
        df.columns = ['Referencia', 'Empresa', 'Cantidad']
        return df.dropna(subset=['Referencia'])
    except Exception as e:
        print(f"Error reading Sonepar: {e}")
        return pd.DataFrame(columns=['Referencia', 'Empresa', 'Cantidad'])

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        df = pd.read_excel(file)
        
        # Heurística para encontrar columnas
        ref_col = None
        qty_col = None
        
        ref_keywords = ['referencia', 'ref', 'código', 'cod', 'articulo', 'item', 'part number', 'p/n']
        qty_keywords = ['cantidad', 'cant', 'qty', 'units', 'uds', 'unidades', 'cantidad pedida']
        
        # 1. Buscar por nombres de columnas (case insensitive)
        cols_lower = [str(c).lower() for c in df.columns]
        
        for kw in ref_keywords:
            if kw in cols_lower:
                ref_col = df.columns[cols_lower.index(kw)]
                break
        
        for kw in qty_keywords:
            if kw in cols_lower:
                qty_col = df.columns[cols_lower.index(kw)]
                break
                
        # 2. Si no se encuentran, buscar por contenido y patrones
        if not ref_col:
            # Buscar columna con strings alfanuméricos largos o con guiones
            for col in df.columns:
                if df[col].dtype == object:
                    sample = df[col].dropna().head(10).astype(str)
                    # Si la mayoría parecen referencias (ej. longitud > 3, sin espacios excesivos)
                    if sample.str.len().mean() > 3:
                        ref_col = col
                        break

        if not qty_col:
            # Buscar columna numérica que no sea el índice ni la de referencia
            for col in df.columns:
                if col != ref_col and pd.api.types.is_numeric_dtype(df[col]):
                    qty_col = col
                    break

        if not ref_col:
            return jsonify({'error': 'No se pudo detectar la columna de referencia'}), 400

        # Limpiar datos
        result_df = df[[ref_col]].copy()
        result_df.columns = ['reference']
        if qty_col:
            result_df['quantity'] = df[qty_col]
        else:
            result_df['quantity'] = 1 # Default if not found

        result_df = result_df.dropna(subset=['reference'])
        # Asegurar que reference sea string
        result_df['reference'] = result_df['reference'].astype(str).str.strip()
        
        # Reemplazar NaN por 0 para evitar errores de JSON
        result_df = result_df.fillna(0)
        
        return jsonify(result_df.to_dict('records'))

    except Exception as e:
        print(f"Error processing upload: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    # Puede recibir una lista de strings o una lista de objetos {reference, quantity}
    input_data = data.get('references', [])
    
    if not input_data:
        return jsonify({'inventario': [], 'sonepar': []})

    references_to_search = []
    qty_map = {}

    for item in input_data:
        if isinstance(item, str):
            ref = item.strip()
            qty = 0
        else:
            ref = str(item.get('reference', '')).strip()
            qty = item.get('quantity', 0)
        
        if ref:
            references_to_search.append(ref)
            qty_map[ref] = qty

    df_inv = read_inventario()
    df_son = read_sonepar()

    # Convertir referencias a string para comparar
    df_inv['Referencia'] = df_inv['Referencia'].astype(str).str.strip()
    df_son['Referencia'] = df_son['Referencia'].astype(str).str.strip()

    # Filtrar resultados
    res_inv = df_inv[df_inv['Referencia'].isin(references_to_search)].to_dict('records')
    res_son = df_son[df_son['Referencia'].isin(references_to_search)].to_dict('records')

    # Añadir la cantidad del encargo si existe
    for item in res_inv:
        item['CantEncargo'] = qty_map.get(item['Referencia'], 0)
    for item in res_son:
        item['CantEncargo'] = qty_map.get(item['Referencia'], 0)

    return jsonify({
        'inventario': res_inv,
        'sonepar': res_son
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
