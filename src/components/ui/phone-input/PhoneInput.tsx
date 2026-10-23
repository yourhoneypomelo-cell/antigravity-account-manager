import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CountryCodeItem,
  COUNTRIES,
  POPULAR_COUNTRIES,
  filterCountries,
  findCountryByCode,
  findCountryByDialCode,
  formatFullPhone,
  parsePhoneNumber,
} from "@/lib/countryData";

export interface PhoneInputProps {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  className,
  placeholder = "例如：147 9292 4955",
  ariaLabel = "辅助电话号码",
}: PhoneInputProps) {
  // Parse initial value
  const initialParsed = useMemo(() => {
    return parsePhoneNumber(value || "", "+86");
  }, []);

  const [selectedCountry, setSelectedCountry] = useState<CountryCodeItem>(
    initialParsed.country
  );
  const [dialCodeText, setDialCodeText] = useState<string>(
    initialParsed.dialCode
  );
  const [nationalNumber, setNationalNumber] = useState<string>(
    initialParsed.nationalNumber
  );

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const dialInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync when external value prop changes from outside (e.g. account switch or reset)
  useEffect(() => {
    if (value === undefined || value === null) {
      setNationalNumber("");
      return;
    }
    const currentCombined = formatFullPhone(selectedCountry.dialCode, nationalNumber);
    if (value.trim() !== currentCombined.trim()) {
      const parsed = parsePhoneNumber(value, selectedCountry.dialCode);
      setSelectedCountry(parsed.country);
      setDialCodeText(parsed.dialCode);
      setNationalNumber(parsed.nationalNumber);
    }
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setDialCodeText(selectedCountry.dialCode);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, selectedCountry]);

  // Filtered countries list
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return null; // Use popular + all layout
    return filterCountries(searchQuery);
  }, [searchQuery]);

  // Notify parent of phone change
  const triggerChange = (dialCode: string, num: string) => {
    const trimmedNum = num.trim();
    if (!trimmedNum) {
      onChange("");
    } else {
      onChange(formatFullPhone(dialCode, trimmedNum));
    }
  };

  const handleSelectCountry = (country: CountryCodeItem) => {
    setSelectedCountry(country);
    setDialCodeText(country.dialCode);
    setIsOpen(false);
    setSearchQuery("");
    triggerChange(country.dialCode, nationalNumber);
    setTimeout(() => {
      phoneInputRef.current?.focus();
    }, 50);
  };

  // Dial code input typing (Combobox: input + dropdown)
  const handleDialCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDialCodeText(text);
    setSearchQuery(text);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);

    // If user typed exact dial code matching a country, e.g. "+86", "+1", "+852"
    const exact = findCountryByDialCode(text);
    if (exact) {
      setSelectedCountry(exact);
      triggerChange(exact.dialCode, nationalNumber);
    }
  };

  const handleDialCodeInputBlur = () => {
    // If text matches a valid dial code or country
    const trimmed = dialCodeText.trim();
    const candidate = findCountryByDialCode(trimmed) || filterCountries(trimmed)[0];
    if (candidate) {
      setSelectedCountry(candidate);
      setDialCodeText(candidate.dialCode);
      triggerChange(candidate.dialCode, nationalNumber);
    } else {
      setDialCodeText(selectedCountry.dialCode);
    }
  };

  // Keyboard navigation inside Combobox
  const handleDialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const count = filteredList ? filteredList.length : POPULAR_COUNTRIES.length + COUNTRIES.length;
        setHighlightedIndex((prev) => (prev + 1) % count);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        const count = filteredList ? filteredList.length : POPULAR_COUNTRIES.length + COUNTRIES.length;
        setHighlightedIndex((prev) => (prev - 1 + count) % count);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen) {
        if (filteredList && filteredList.length > 0) {
          handleSelectCountry(filteredList[Math.min(highlightedIndex, filteredList.length - 1)]);
        } else if (!filteredList && POPULAR_COUNTRIES.length > 0) {
          handleSelectCountry(POPULAR_COUNTRIES[Math.min(highlightedIndex, POPULAR_COUNTRIES.length - 1)]);
        }
      } else {
        phoneInputRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
      setDialCodeText(selectedCountry.dialCode);
    }
  };

  // Smart Detection when pasting into phone input
  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasteText = e.clipboardData.getData("text");
    if (!pasteText) return;

    const parsed = parsePhoneNumber(pasteText, selectedCountry.dialCode);
    // If the pasted string contains a recognized country code or international format
    if (
      pasteText.startsWith("+") ||
      pasteText.startsWith("00") ||
      pasteText.includes(" ") ||
      pasteText.includes("-") ||
      parsed.dialCode !== selectedCountry.dialCode ||
      (pasteText.replace(/\D/g, "").length === 13 && pasteText.startsWith("861"))
    ) {
      e.preventDefault();
      setSelectedCountry(parsed.country);
      setDialCodeText(parsed.dialCode);
      setNationalNumber(parsed.nationalNumber);
      triggerChange(parsed.dialCode, parsed.nationalNumber);
    }
  };

  // Smart Detection when typing into phone input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Check if user typed or pasted with country code
    if (
      raw.startsWith("+") ||
      raw.startsWith("00") ||
      (raw.replace(/\D/g, "").length === 13 && raw.startsWith("861"))
    ) {
      const parsed = parsePhoneNumber(raw, selectedCountry.dialCode);
      setSelectedCountry(parsed.country);
      setDialCodeText(parsed.dialCode);
      setNationalNumber(parsed.nationalNumber);
      triggerChange(parsed.dialCode, parsed.nationalNumber);
      return;
    }

    setNationalNumber(raw);
    triggerChange(selectedCountry.dialCode, raw);
  };

  // Smart Detection if user pastes full phone number into the dial code box!
  const handleDialCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasteText = e.clipboardData.getData("text");
    if (!pasteText) return;
    const digits = pasteText.replace(/\D/g, "");
    if (digits.length > 5) {
      // It's a full phone number!
      e.preventDefault();
      const parsed = parsePhoneNumber(pasteText, selectedCountry.dialCode);
      setSelectedCountry(parsed.country);
      setDialCodeText(parsed.dialCode);
      setNationalNumber(parsed.nationalNumber);
      setIsOpen(false);
      triggerChange(parsed.dialCode, parsed.nationalNumber);
      phoneInputRef.current?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex gap-2 items-center w-full", className)}
    >
      {/* 1. Country Code Combobox (可输入 亦可下拉) */}
      <div className="relative w-[130px] shrink-0">
        <div className="relative flex items-center">
          <span
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none"
            aria-hidden="true"
          >
            {selectedCountry.flag || <Globe className="w-3.5 h-3.5 text-muted-foreground" />}
          </span>
          <input
            ref={dialInputRef}
            type="text"
            disabled={disabled}
            readOnly={readOnly}
            value={dialCodeText}
            onChange={handleDialCodeInputChange}
            onBlur={handleDialCodeInputBlur}
            onKeyDown={handleDialKeyDown}
            onPaste={handleDialCodePaste}
            onFocus={() => {
              if (disabled || readOnly) return;
              setIsOpen(true);
              setSearchQuery(dialCodeText.replace(/\+/, ""));
            }}
            placeholder="+86"
            aria-label="国家或地区区号"
            aria-expanded={isOpen}
            className={cn(
              "vault-field h-9 pl-8 pr-7 text-[13px] font-mono-numbers w-full",
              readOnly ? "cursor-default" : "cursor-text"
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || readOnly}
            onClick={() => {
              if (disabled || readOnly) return;
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                dialInputRef.current?.focus();
                setSearchQuery("");
              }
            }}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-transform",
              readOnly || disabled
                ? "text-muted-foreground/50 cursor-default"
                : "text-muted-foreground hover:text-foreground cursor-pointer"
            )}
            aria-label="展开或收起区号下拉列表"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-150",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* Dropdown Popover */}
        {isOpen && (
          <div
            ref={listRef}
            className="absolute left-0 top-[calc(100%+4px)] w-[280px] max-h-[290px] overflow-y-auto rounded-lg border border-border-subtle bg-popover text-popover-foreground shadow-xl z-50 p-1.5 scrollbar-thin"
            role="listbox"
            aria-label="国家或地区列表"
          >
            {/* Filtered Search Results */}
            {filteredList ? (
              filteredList.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  未找到匹配的国家或区号
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    搜索结果 ({filteredList.length})
                  </div>
                  {filteredList.map((country, idx) => {
                    const isSelected = country.code === selectedCountry.code;
                    return (
                      <div
                        key={country.code}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectCountry(country)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors",
                          isSelected
                            ? "bg-accent text-accent-foreground font-medium"
                            : "hover:bg-accent/60 text-foreground"
                        )}
                      >
                        <span className="text-sm shrink-0">{country.flag}</span>
                        <span className="truncate flex-1">
                          {country.name}
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            ({country.nameEn})
                          </span>
                        </span>
                        <span className="font-mono-numbers text-[11px] text-muted-foreground tabular-nums shrink-0">
                          {country.dialCode}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Default: Popular + All */
              <div className="space-y-1">
                {/* 1. Popular Countries */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    常用国家与地区
                  </div>
                  <div className="space-y-0.5">
                    {POPULAR_COUNTRIES.map((country) => {
                      const isSelected = country.code === selectedCountry.code;
                      return (
                        <div
                          key={`pop-${country.code}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectCountry(country)}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground font-medium"
                              : "hover:bg-accent/60 text-foreground"
                          )}
                        >
                          <span className="text-sm shrink-0">{country.flag}</span>
                          <span className="truncate flex-1">{country.name}</span>
                          <span className="font-mono-numbers text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {country.dialCode}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="h-px bg-border-subtle my-1" />

                {/* 2. All Countries */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    全部国家与地区
                  </div>
                  <div className="space-y-0.5">
                    {COUNTRIES.map((country) => {
                      const isSelected = country.code === selectedCountry.code;
                      return (
                        <div
                          key={`all-${country.code}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectCountry(country)}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground font-medium"
                              : "hover:bg-accent/60 text-foreground"
                          )}
                        >
                          <span className="text-sm shrink-0">{country.flag}</span>
                          <span className="truncate flex-1">
                            {country.name}
                            <span className="ml-1 text-[11px] text-muted-foreground">
                              ({country.nameEn})
                            </span>
                          </span>
                          <span className="font-mono-numbers text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {country.dialCode}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. National Phone Number Input */}
      <input
        ref={phoneInputRef}
        type="tel"
        disabled={disabled}
        readOnly={readOnly}
        value={nationalNumber}
        onChange={handlePhoneChange}
        onPaste={handlePhonePaste}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "vault-field h-9 px-3 text-[13px] font-mono-numbers flex-1 min-w-0",
          readOnly && "cursor-default"
        )}
      />
    </div>
  );
}
