import os
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Rutas de los archivos de Excel
PATH_INVENTARIO = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\INVENTARIO Cerdanya (NUEVO).xlsx"
PATH_SONEPAR = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\STOCK SCHNEIDER-SONEPAR 26.xlsx"
PATH_STI = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\ZOE STI.xlsx"

def read_inventario():
    try:
        # Col A = Ubicación (index 0), Col B = Referencia (index 1), Col E = Cantidad (index 4)
        df = pd.read_excel(PATH_INVENTARIO, usecols=[0, 1, 4])
        df.columns = ['Ubicacion', 'Referencia', 'Cantidad']
        df = df.dropna(subset=['Referencia'])
        
        # Limpiar valores NaN para evitar errores de JSON
        df['Cantidad'] = pd.to_numeric(df['Cantidad'], errors='coerce').fillna(0)
        df['Ubicacion'] = df['Ubicacion'].fillna('')
        df = df.replace([float('inf'), float('-inf')], 0)
        
        return df
    except Exception as e:
        print(f"Error reading Inventario: {e}")
        return pd.DataFrame(columns=['Ubicacion', 'Referencia', 'Cantidad'])

def read_sonepar():
    try:
        # Primero leemos las cabeceras para identificar los nombres de las columnas
        df_header = pd.read_excel(PATH_SONEPAR, nrows=0)

        if len(df_header.columns) < 2:
            print("Error: El archivo Sonepar no tiene suficientes columnas.")
            return pd.DataFrame(columns=['Referencia', 'Empresa', 'Cantidad'])

        col_ref = df_header.columns[1]  # Columna B = Referencia (posición fija)

        # Buscar columna "empresa" dinámicamente (independiente de su posición)
        col_emp = None
        for col in df_header.columns:
            if "empresa" in str(col).lower():
                col_emp = col
                print(f"✓ Columna 'empresa' encontrada: '{col}'")
                break

        if col_emp is None:
            # Fallback a índice 16 (columna R) si no se encuentra por nombre
            if len(df_header.columns) > 16:
                col_emp = df_header.columns[16]
                print(f"⚠ Aviso: Columna 'empresa' no encontrada. Usando columna índice 16: '{col_emp}'")
            else:
                print("❌ Error: Columna 'empresa' no encontrada.")
                print(f"Columnas disponibles: {list(df_header.columns)}")
                return pd.DataFrame(columns=['Referencia', 'Empresa', 'Cantidad'])

        # Buscar la columna "resto" dinámicamente (independiente de su posición)
        col_qty = None
        for idx, col in enumerate(df_header.columns):
            if "resto" in str(col).lower():
                col_qty = col
                print(f"✓ Columna 'resto' encontrada: '{col}' en posición {idx}")
                break

        if col_qty is None:
            # Fallback a índice 30 si existe
            if len(df_header.columns) > 30:
                col_qty = df_header.columns[30]
                print(f"⚠ Aviso: Columna 'resto' no encontrada. Usando columna índice 30: '{col_qty}'")
            else:
                print("❌ Error: Columna 'resto' no encontrada y archivo demasiado corto para índice 30.")
                print(f"Columnas disponibles: {list(df_header.columns)}")
                return pd.DataFrame(columns=['Referencia', 'Empresa', 'Cantidad'])

        # Leer datos con las columnas identificadas
        cols_to_use = list(set([col_ref, col_emp, col_qty]))
        df = pd.read_excel(PATH_SONEPAR, usecols=cols_to_use)

        result = pd.DataFrame()
        result['Referencia'] = df[col_ref]
        result['Empresa'] = df[col_emp]
        result['Cantidad'] = df[col_qty]

        result = result.dropna(subset=['Referencia'])

        # Limpiar valores NaN
        result['Cantidad'] = pd.to_numeric(result['Cantidad'], errors='coerce').fillna(0)
        result['Empresa'] = result['Empresa'].fillna('')
        result = result.replace([float('inf'), float('-inf')], 0)

        print(f"✓ Archivo Sonepar leído correctamente: {len(result)} registros encontrados")

        return result

    except Exception as e:
        print(f"❌ Error reading Sonepar: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame(columns=['Referencia', 'Empresa', 'Cantidad'])


def read_sti():
    """Lee el archivo ZOE STI.xlsx y extrae la columna 'código' dinámicamente."""
    try:
        df_header = pd.read_excel(PATH_STI, nrows=0)

        # Buscar columna "código" dinámicamente
        col_cod = None
        for col in df_header.columns:
            if "código" in str(col).lower() or "codigo" in str(col).lower() or "cod" == str(col).strip().lower():
                col_cod = col
                print(f"✓ Columna 'código' encontrada en STI: '{col}'")
                break

        if col_cod is None:
            print(f"❌ Error: Columna 'código' no encontrada en STI.")
            print(f"Columnas disponibles: {list(df_header.columns)}")
            return pd.DataFrame(columns=['Referencia'])

        df = pd.read_excel(PATH_STI, usecols=[col_cod])
        result = pd.DataFrame()
        result['Referencia'] = df[col_cod].astype(str).str.strip()
        result = result[result['Referencia'].str.len() > 0]
        result = result[result['Referencia'] != 'nan']

        print(f"✓ Archivo STI leído correctamente: {len(result)} registros encontrados")
        return result

    except Exception as e:
        print(f"❌ Error reading STI: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame(columns=['Referencia'])

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
        
        # Convertir quantity a numérico y reemplazar NaN/errores por 0
        result_df['quantity'] = pd.to_numeric(result_df['quantity'], errors='coerce').fillna(0)
        
        # Asegurar que no haya valores NaN, inf o -inf en ninguna columna
        result_df = result_df.replace([float('inf'), float('-inf')], 0)
        result_df = result_df.fillna(0)
        
        # Convertir a diccionario y asegurar que todos los valores sean JSON-serializables
        records = result_df.to_dict('records')
        
        # Limpieza final: asegurar que no hay NaN en los registros
        for record in records:
            for key, value in record.items():
                if pd.isna(value) or value in [float('inf'), float('-inf')]:
                    record[key] = 0 if key == 'quantity' else ''
        
        return jsonify(records)

    except Exception as e:
        print(f"Error processing upload: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    # Puede recibir una lista de strings o una lista de objetos {reference, quantity}
    input_data = data.get('references', [])
    added_stock_input = data.get('addedStock', [])

    if not input_data:
        return jsonify({'inventario': [], 'sonepar': [], 'sti': [], 'addedStock': []})

    references_to_search = []
    qty_map = {}

    for item in input_data:
        if isinstance(item, str):
            ref = item.strip().upper()
            qty = 0
        else:
            ref = str(item.get('reference', '')).strip().upper()
            qty = item.get('quantity', 0)
        
        if ref:
            references_to_search.append(ref)
            qty_map[ref] = qty_map.get(ref, 0) + float(qty)

    # Procesar Stock Añadido (Dinámico)
    added_stock_map = {}
    for item in added_stock_input:
        ref = str(item.get('reference', '')).strip().upper()
        qty = item.get('quantity', 0)
        if ref:
            added_stock_map[ref] = added_stock_map.get(ref, 0) + float(qty)

    df_inv = read_inventario()
    df_son = read_sonepar()
    df_sti = read_sti()

    # Convertir a mayúsculas para búsqueda exacta case-insensitive
    df_inv['Referencia_UC'] = df_inv['Referencia'].astype(str).str.strip().str.upper()
    df_son['Referencia_UC'] = df_son['Referencia'].astype(str).str.strip().str.upper()
    df_sti['Referencia_UC'] = df_sti['Referencia'].astype(str).str.strip().str.upper()

    # Filtrar resultados de archivos fijos
    res_inv = df_inv[df_inv['Referencia_UC'].isin(references_to_search)].to_dict('records')
    res_son = df_son[df_son['Referencia_UC'].isin(references_to_search)].to_dict('records')
    res_sti_refs = set(df_sti[df_sti['Referencia_UC'].isin(references_to_search)]['Referencia'].tolist())

    # Filtrar resultados de Stock Añadido
    res_added = []
    # Usamos set para evitar duplicados si la misma referencia está varias veces en la búsqueda
    unique_refs_to_search = set(references_to_search)
    for ref in unique_refs_to_search:
        if ref in added_stock_map and added_stock_map[ref] > 0:
            res_added.append({
                'Referencia': ref,
                'Cantidad': added_stock_map[ref],
                'CantEncargo': qty_map.get(ref, 0)
            })

    # Filtrar stock 0
    res_inv = [item for item in res_inv if float(item.get('Cantidad', 0)) > 0]
    res_son = [item for item in res_son if float(item.get('Cantidad', 0)) > 0]

    # Limpiar columnas temporales y añadir CantEncargo
    for item in res_inv:
        item.pop('Referencia_UC', None)
        ref_upper = str(item['Referencia']).strip().upper()
        item['CantEncargo'] = qty_map.get(ref_upper, 0)
        for key, value in item.items():
            if pd.isna(value):
                item[key] = 0 if key in ['Cantidad', 'CantEncargo'] else ''

    for item in res_son:
        item.pop('Referencia_UC', None)
        ref_upper = str(item['Referencia']).strip().upper()
        item['CantEncargo'] = qty_map.get(ref_upper, 0)
        for key, value in item.items():
            if pd.isna(value):
                item[key] = 0 if key in ['Cantidad', 'CantEncargo'] else ''

    return jsonify({
        'inventario': res_inv,
        'sonepar': res_son,
        'sti': list(res_sti_refs),
        'addedStock': res_added
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', debug=True, port=5000)
