import { Disposable, QuickPick, QuickPickItem, window } from "vscode";


type ItemOp<T extends QuickPickItem, D extends Consult<T>> = (this: D) => T[] | Promise<T[]>;


// All of these functions can assume that `this.quickPick` is defined.
export type ConsultOps<T extends QuickPickItem, D extends Consult<T>> = {
    // preHooks?: ((this: D) => void | Promise<void>)[],

    /**
     * Generate all items and assign to `Consult.items`.
     *
     * Serves as the full record of items, in case that the items to show in the quick pick change frequently.
     */
    itemGenerator?: ItemOp<T, D>,
    /**
     * Modify `Consult.items` according to some rules.
     *
     * Usually used in subsequent commands after all items have benn generated.
     */
    itemModifiers?: ItemOp<T, D>[],
    /**
     * Select items to show in the quick pick.
     */
    itemSelectors?: ItemOp<T, D>[],
    /**
     * Callback on changing input.
     */
    onChangeValue?: ((this: Readonly<D>, oldValue: string, newValue: string) => void | Promise<void>)[],
    /**
     * Callback on accepting an item.
     */
    onAcceptItems?: ((this: D) => any)[],
    /**
     * Callback on quick pick disappearing.
     */
    onHide?: ((this: D) => any)[],
};


export class Consult<T extends QuickPickItem> {
    //
    /**
     * Shared across all instances.
     * Only in FileBrowser, these are toggleable.
     * In other cases:
     *   1) dot files are always included
     *   2) filter globs are always respected
     *   3) if related to projects, dot ignore files are always respected
     */
    static hideDotFiles: boolean = true;
    static filterFiles: boolean = true;

    quickPick?: QuickPick<T>;
    items: T[] = [];

    // Keep track of event listener disposables.
    disposablesOnChangeValue: Disposable[] = [];
    disposablesOnAcceptItems: Disposable[] = [];
    disposablesOnHide: Disposable[] = [];

    lastValue: string = "";
    curDir?: string;

    async createQuickPick<D extends Consult<T>>(this: D, ops: ConsultOps<T, D>) {
        // CONSIDERATIONS
        // If we allow to create a new quick pick while an old one exists,
        // after setting up everything via `update`,
        // and right on the new quick pick showing up,
        // the old one's `onDidHide` will be triggered,
        // which will then destroy everything.
        if (this.quickPick !== undefined) {
            throw new Error("Don't call this when a quick pick is already created.");
        }

        this.quickPick = window.createQuickPick();
        if (process.env.DEBUG_MODE === "true")
            this.quickPick.ignoreFocusOut = true;

        await this.update(ops, true);
        this.quickPick!.show();
    }

    async update<D extends Consult<T>>(this: D, ops: ConsultOps<T, D>, isCreate?: boolean) {
        // CONSIDERATIONS for the callbacks.
        //
        // On quick pick creation, providing new callbacks or not are both OK.
        //
        // Otherwise, since it's an update,
        //   - if provided,
        //     FOR NOW we consider that old callbacks may not apply to new items, and thus we overwrite the old ones,
        //   - if not provided,
        //     FOR NOW we consider that the old ones are still valid, and thus we keep them.
        if (ops.onChangeValue) {
            this.disposablesOnChangeValue.forEach((d) => { d.dispose(); })
            this.disposablesOnChangeValue = [];

            async function onChangeValue(this: D, value: string) {
                let oldValue = this.lastValue,
                    newValue = value;
                this.lastValue = newValue;

                for (let cb of ops.onChangeValue!) {
                    await cb.call(this, oldValue, newValue);
                }
            }
            let d = this.quickPick!.onDidChangeValue(onChangeValue.bind(this));
            this.disposablesOnChangeValue.push(d);
        }

        if (ops.onAcceptItems) {
            this.disposablesOnAcceptItems.forEach((d) => { d.dispose(); })
            this.disposablesOnAcceptItems = [];

            async function onAcceptItems(this: D) {
                for (let cb of ops.onAcceptItems!) {
                    await cb.call(this);
                }
            }
            let d = this.quickPick!.onDidAccept(onAcceptItems.bind(this));
            this.disposablesOnAcceptItems.push(d);
        }

        async function onHide(this: D) {
            for (let cb of (ops.onHide || []))
                await cb.call(this);
            this.reset()
        }
        if (isCreate || ops.onHide) {
            this.disposablesOnHide.forEach((d) => { d.dispose(); })
            this.disposablesOnHide = [];
            let d = this.quickPick!.onDidHide(onHide.bind(this));
            this.disposablesOnHide.push(d);
        }

        // if (ops.preHooks) {
        //     for (let hook of ops.preHooks) {
        //         await hook.call(this);
        //     }
        // }

        if (ops.itemGenerator) {
            this.items = await ops.itemGenerator.call(this);
        }

        if (ops.itemModifiers) {
            for (let mod of ops.itemModifiers) {
                let items = await mod.call(this);
                this.items = items;
            }
        }

        // If provided `ops.itemSelectors` and not empty, use it.
        // If empty, use `this.items`.
        // Otherwise, do nothing.
        if (ops.itemSelectors !== undefined) {
            if (ops.itemSelectors.length > 0) {
                for (let sel of ops.itemSelectors) {
                    let items = await sel.call(this);
                    this.quickPick!.items = items;
                }
            } else {
                this.quickPick!.items = this.items;
            }
        }
    }

    reset() {
        if (this.quickPick !== undefined) {
            this.quickPick!.dispose();
            this.quickPick = undefined;
        }
        this.items = [];

        this.disposablesOnChangeValue.forEach((d) => { d.dispose(); })
        this.disposablesOnChangeValue = [];
        this.disposablesOnAcceptItems.forEach((d) => { d.dispose(); })
        this.disposablesOnAcceptItems = [];
        this.disposablesOnHide.forEach((d) => { d.dispose(); })
        this.disposablesOnHide = [];

        this.lastValue = "";
        this.curDir = undefined;
    }
}
