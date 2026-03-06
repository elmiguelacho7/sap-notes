 import type { InputHTMLAttributes } from "react";
 import { Search } from "lucide-react";
 import { Input } from "@/components/ui/Input";
 
 export function SearchInput({
   className = "",
   inputClassName = "",
   ...props
 }: InputHTMLAttributes<HTMLInputElement> & {
   inputClassName?: string;
 }) {
   return (
     <div className={`relative ${className}`}>
       <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
       <Input
         {...props}
         type={props.type ?? "search"}
         className={`pl-10 ${inputClassName}`}
       />
     </div>
   );
 }
