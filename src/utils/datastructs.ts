/**
 * A map with size limit.
 *
 * On Insertion, when exceeding size limit, the oldest item will be deleted.
 * So can be used as a simple cache.
 */
export class FixSizedMap<K, V> {
    private data: Map<K, V>;
    private maxEntries: number;

    constructor(maxEntries: number) {
        this.data = new Map<K, V>();
        this.maxEntries = maxEntries;
    }

    public has(key: K): boolean {
        return this.data.has(key);
    }

    public get(key: K): V | undefined {
        return this.data.get(key);
    }

    public set(key: K, value: V) {
        if (this.data.has(key)) {
            this.data.delete(key);
        } else if (this.data.size >= this.maxEntries) {
            this.data.delete(this.data.keys().next().value);
        }

        this.data.set(key, value);
    }
}

/**
 * A cache of fixed size, that makes the most recently stored item has the highest weight (array index).
 *
 * Mainly used to sort items.
 */
export class WeightedCache<T> {
    arr: T[];
    maxEntries: number;

    constructor(maxEntries: number) {
        this.arr = [];
        this.maxEntries = maxEntries;
    }

    public getWeight(key: T): number {
        return this.arr.indexOf(key);
    }

    public put(key: T) {
        let idx = this.arr.indexOf(key);
        if (idx !== -1) {
            this.arr.splice(idx, 1);
        } else {
            while (this.arr.length >= this.maxEntries) {
                this.arr.shift();
            }
        }

        this.arr.push(key);
    }
}


class LinkedListNode<K, V> {
    prev?: LinkedListNode<K, V> = undefined;
    next?: LinkedListNode<K, V> = undefined;
    key?: K = undefined;
    value?: V = undefined;

    constructor(prev?: LinkedListNode<K, V>, next?: LinkedListNode<K, V>, key?: K, value?: V) {
        this.prev = prev;
        this.next = next;
        this.key = key;
        this.value = value;
    }
}


enum MapGetType {
    key = "key",
    value = "value",
    entry = "entry"
}

export class LruMap<K, V> {
    size: number;
    private capacity: number;
    private indexMap: Map<K, LinkedListNode<K, V>>;
    private head: LinkedListNode<K, V>;
    private tail: LinkedListNode<K, V>;

    constructor(maxEntries: number) {
        this.size = 0;
        this.capacity = maxEntries;
        this.indexMap = new Map<K, LinkedListNode<K, V>>();
        this.head = new LinkedListNode<K, V>();
        this.tail = new LinkedListNode<K, V>();
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    public get(key: K): V | undefined {
        if (!this.indexMap.has(key)) {
            return undefined;
        }

        let node = this.indexMap.get(key)!;
        this.moveNodeToHead(node);
        return node.value;
    }

    public set(key: K, value: V) {
        if (this.get(key)) {
            this.indexMap.get(key)!.value = value;
            return;
        }

        let node = new LinkedListNode<K, V>(this.head, this.head.next!, key, value);
        this.head.next!.prev = node;
        this.head.next = node;
        this.indexMap.set(key, node);

        if (this.indexMap.size > this.capacity) {
            this.indexMap.delete(this.tail.prev!.key!);
            this.deleteNode(this.tail.prev!);
        }

        this.size = this.indexMap.size;
    }

    delete(key: K): boolean {
        let node = this.indexMap.get(key);
        if (node) {
            this.deleteNode(node);
        }
        let deleted = this.indexMap.delete(key);
        this.size = this.indexMap.size;
        return deleted;
    }

    has(key: K): boolean {
        return this.indexMap.has(key);
    }

    clear() {
        this.indexMap.clear();
        this.size = this.indexMap.size;
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    keys(): K[] {
        let keys: K[] = [];
        let node = this.head.next!;
        while (node.next) {
            if (this.indexMap.has(node.key!)) {
                keys.push(node.key!);
            }
            node = node.next;
        }
        return keys;
    }

    values(): V[] {
        let values: V[] = [];
        let node = this.head.next!;
        while (node.next) {
            if (this.indexMap.has(node.key!)) {
                values.push(node.value!);
            }
            node = node.next;
        }
        return values;
    }

    entries(): [K, V][] {
        let entries: [K, V][] = [];
        let node = this.head.next!;
        while (node.next) {
            entries.push([node.key!, node.value!]);
            node = node.next;
        }
        return entries;
    }

    moveNodeToHead(node: LinkedListNode<K, V>) {
        node.prev!.next = node.next;
        node.next!.prev = node.prev;
        node.prev = this.head;
        node.next = this.head.next;
        this.head.next!.prev = node;
        this.head.next = node;
    }

    deleteNode(node: LinkedListNode<K, V>) {
        node.prev!.next = node.next;
        node.next!.prev = node.prev;
        node.prev = undefined;
        node.next = undefined;
    }
}


// class LruMapIterator<K, V> implements Iterator<[K, V]> {
//     private indexMap: Map<K, LinkedListNode<K, V>>;
//     private head: LinkedListNode<K, V>;
//     private tail: LinkedListNode<K, V>;

//     constructor(index: Map<K, LinkedListNode<K, V>>, head: LinkedListNode<K, V>, tail: LinkedListNode<K, V>) {
//         this.indexMap = index;
//         this.head = head;
//         this.tail = tail;
//     }
// }