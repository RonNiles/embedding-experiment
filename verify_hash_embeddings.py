"""
Verify that all rows in the document table with the same hash also have
the same embedding. Prints a summary and details of any mismatches.
"""

import os
import psycopg2

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/appdb"
)


def main():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            # Find hashes that appear on more than one row
            cur.execute("""
                SELECT hash
                FROM document
                WHERE hash IS NOT NULL
                GROUP BY hash
                HAVING COUNT(*) > 1
            """)
            duplicate_hashes = [row[0] for row in cur.fetchall()]

        if not duplicate_hashes:
            print("No duplicate hashes found — nothing to verify.")
            return

        print(f"Found {len(duplicate_hashes)} hash(es) with multiple rows. Checking embeddings...\n")

        mismatches = []
        max_diff_found = 0

        with conn.cursor() as cur:
            for h in duplicate_hashes:
                cur.execute(
                    "SELECT id, embedding FROM document WHERE hash = %s ORDER BY id",
                    (h,)
                )
                rows = cur.fetchall()

                def parse_emb(e):
                    if e is None:
                        return None
                    if isinstance(e, str):
                        return [float(x) for x in e.strip("[]").split(",")]
                    return list(e)

                # Compare every embedding to the first one, element by element
                first_id, first_emb_raw = rows[0]
                first_emb = parse_emb(first_emb_raw)
                for row_id, emb_raw in rows[1:]:
                    emb = parse_emb(emb_raw)
                    first_mismatch_index = None
                    if first_emb is None or emb is None:
                        first_mismatch_index = 0
                    else:
                        for i, (a, b) in enumerate(zip(first_emb, emb)):
                            diff = abs(float(a) - float(b))
                            max_diff_found = max(max_diff_found, diff)
                            if diff > 0.01:
                                first_mismatch_index = i
                                break
                        if first_mismatch_index is None and len(first_emb) != len(emb):
                            first_mismatch_index = min(len(first_emb), len(emb))

                    if first_mismatch_index is not None:
                        mismatch = {
                            "hash": h,
                            "id_a": first_id,
                            "id_b": row_id,
                            "emb_a_null": first_emb is None,
                            "emb_b_null": emb is None,
                            "first_mismatch_index": first_mismatch_index,
                        }
                        if first_emb is not None and emb is not None:
                            mismatch["value_a"] = first_emb[first_mismatch_index]
                            mismatch["value_b"] = emb[first_mismatch_index]
                        mismatches.append(mismatch)

        print(f"Maximum absolute difference found: {max_diff_found:.4f}\n")
        if not mismatches:
            print("All rows with the same hash have identical embeddings. ✓")
        else:
            print(f"MISMATCHES FOUND: {len(mismatches)} pair(s) differ\n")
            for m in mismatches:
                detail = f"(null: {m['emb_a_null']} vs {m['emb_b_null']})"
                if not m["emb_a_null"] and not m["emb_b_null"]:
                    detail = (
                        f"first mismatch at index {m['first_mismatch_index']}: "
                        f"{m['value_a']} vs {m['value_b']}"
                    )
                print(
                    f"  hash={m['hash']!r}  "
                    f"row {m['id_a']} vs row {m['id_b']}  "
                    f"{detail}"
                )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
