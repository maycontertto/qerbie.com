export type MenuOption = {
  id: string;
  name: string;
  price_modifier: number;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  selection_type: "single" | "multiple";
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  options: MenuOption[];
};
