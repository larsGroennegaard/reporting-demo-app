// app/components/MultiSelectFilter.tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type OptionType = {
  value: string;
  label: string;
};

interface MultiSelectProps {
  options: OptionType[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  placeholder?: string;
}

function MultiSelectFilter({
  options,
  selected,
  onChange,
  className,
  placeholder = "Select options...",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelectAll = () => {
    onChange(options.map(option => option.value));
    setOpen(false);
  };
  
  const handleDeselectAll = () => {
    onChange([]);
    setOpen(false);
  };

  const handleSelectOnly = (value: string) => {
    onChange([value]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between bg-gray-700 border-gray-600 hover:bg-gray-600 ${
            selected.length > 0 ? "h-full" : "h-10"
          }`}
          onClick={() => setOpen(!open)}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length > 0 ? (
                <>
                <Badge variant="secondary" className="mr-1">{selected.length} selected</Badge>
                {options.filter(opt => selected.includes(opt.value)).slice(0, 3).map((option) => (
                  <Badge
                    variant="secondary"
                    key={option.value}
                    className="mr-1"
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange(selected.filter((s) => s !== option.value));
                    }}
                  >
                    {option.label}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
                {selected.length > 3 && <Badge variant="secondary">+{selected.length - 3}</Badge>}
                </>
            ) : (
             placeholder
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
                <CommandItem onSelect={handleSelectAll} className="text-xs justify-center cursor-pointer"><span>Select All</span></CommandItem>
                <CommandItem onSelect={handleDeselectAll} className="text-xs justify-center cursor-pointer"><span>Deselect All</span></CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      onChange(
                        isSelected
                          ? selected.filter((s) => s !== option.value)
                          : [...selected, option.value]
                      );
                    }}
                    className="group"
                  >
                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <span>{option.label}</span>
                    <span className="ml-auto text-xs text-gray-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); handleSelectOnly(option.value); }}>
                      ONLY
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { MultiSelectFilter };