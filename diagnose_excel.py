import pandas as pd

PATH_INVENTARIO = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\INVENTARIO Cerdanya (NUEVO).xlsx"
PATH_SONEPAR = r"\\172.30.0.10\Logistica\06-ALMACENES\06.01-ALMACEN CERDANYA\STOCK\STOCK SCHNEIDER-SONEPAR 26.xlsx"

def diagnose(path, name):
    print(f"\n--- Diagnosing {name} ---")
    try:
        df = pd.read_excel(path, nrows=5)
        print("Columns:", list(df.columns))
        print("First 5 rows:\n", df.iloc[:, :10]) # First 10 columns
        
        # Search for the reference in the whole file
        df_full = pd.read_excel(path)
        # Search in all columns just in case
        for col in df_full.columns:
            matches = df_full[df_full[col].astype(str).str.contains('LV429387', case=False, na=False)]
            if not matches.empty:
                print(f"Match found in column '{col}':")
                print(matches)
    except Exception as e:
        print(f"Error diagnosing {name}: {e}")

diagnose(PATH_INVENTARIO, "Inventario")
diagnose(PATH_SONEPAR, "Sonepar")
