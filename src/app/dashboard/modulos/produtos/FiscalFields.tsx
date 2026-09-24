import { PRODUCT_FISCAL_FIELDS, type ProductFiscalData } from "@/lib/catalog/fiscal";

const INPUT_CLASS = "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800";

export function FiscalFields({ defaultValue = {} }: { defaultValue?: ProductFiscalData }) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        Dados fiscais e tributários <span className="font-normal text-zinc-500">(opcional)</span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Preencha conforme a orientação contábil do estabelecimento. Os códigos e alíquotas variam conforme produto, operação, regime e estado; o Qerbie não calcula nem valida tributos.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCT_FISCAL_FIELDS.map((field) => (
          <label key={field.key} className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {field.label}
            <input
              name={`fiscal_${field.key}`}
              type="text"
              maxLength={field.maxLength}
              defaultValue={defaultValue[field.key] ?? ""}
              placeholder={field.placeholder}
              className={`${INPUT_CLASS} mt-1`}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
