import { StorageAdapterInterface, Chunk } from '@automerge/automerge-repo';

/**
 * Automerge storage adapter using DO SQL
 */
export class SqliteStorageAdapter implements StorageAdapterInterface {
	splitChar = '/';

	constructor(private sql: SqlStorage) {
		this.setupTable();
	}

	private setupTable() {
		// Create a table to store Automerge chunks
		this.sql.exec(`
      CREATE TABLE IF NOT EXISTS automerge_chunks(
        key TEXT PRIMARY KEY,
        data BLOB NOT NULL
      );
    `);
	}

	private keyArrayToKey(keyArray: string[]): string {
		return keyArray.join(this.splitChar);
	}

	async load(keyArray: string[]): Promise<Uint8Array | undefined> {
		const key = this.keyArrayToKey(keyArray);
		const result = this.sql.exec<{ data: ArrayBuffer }>(
			'SELECT data FROM automerge_chunks WHERE key = ?',
			key,
		).one();

		if (!result) return undefined;

		return new Uint8Array(result.data);
	}

	async save(keyArray: string[], blob: Uint8Array): Promise<void> {
		const key = this.keyArrayToKey(keyArray);
		this.sql.exec(
			'INSERT OR REPLACE INTO automerge_chunks (key, data) VALUES (?, ?)',
			key,
			blob,
		);
	}

	async remove(keyArray: string[]): Promise<void> {
		const key = this.keyArrayToKey(keyArray);
		this.sql.exec(
			'DELETE FROM automerge_chunks WHERE key = ?',
			key,
		);
	}

	async loadRange(keyPrefix: string[]): Promise<Chunk[]> {
		const prefix = this.keyArrayToKey(keyPrefix);
		const results = this.sql.exec<{ key: string, data: ArrayBuffer }>(
			'SELECT key, data FROM automerge_chunks WHERE key LIKE ? || "%"',
			prefix,
		).toArray();

		return results.map(row => ({
			key: row.key.split(this.splitChar),
			data: new Uint8Array(row.data),
		}));
	}

	async removeRange(keyPrefix: string[]): Promise<void> {
		const prefix = this.keyArrayToKey(keyPrefix);
		this.sql.exec(
			'DELETE FROM automerge_chunks WHERE key LIKE ? || "%"',
			prefix,
		);
	}
}
