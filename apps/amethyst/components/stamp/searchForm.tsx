import { StampContext } from "@/app/(tabs)/(stamp)/stamp/_layout";
import { zodResolver } from "@hookform/resolvers/zod";
import { useContext } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const stampFormSchema = z.object({
  track: z.string(),
  artist: z.string(),
  release: z.string(),
});
type StampForm = z.infer<typeof stampFormSchema>;

export const SearchForm = () => {
  const ctx = useContext(StampContext);

  const {
    control,
    handleSubmit,
    formState: {
      errors,
    }
  } = useForm<StampForm>({
    defaultValues: {
      track: '',
      artist: '',
      release: '',
    },
    resolver: zodResolver(stampFormSchema),
  });
};
