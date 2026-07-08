import { CategoriesClient } from "./CategoriesClient";

export default function CategoriesSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-zinc-900">Categories</h1>
      <CategoriesClient />
    </div>
  );
}
