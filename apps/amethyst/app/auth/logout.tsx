import { router } from "expo-router";
import { Button, ButtonRow, Dialog, goBack, PageTitle } from "@/components/ds";
import { useStore } from "@/stores/mainStore";

export default function SignOut() {
  const logOut = useStore((state) => state.logOut);
  return (
    <>
      <PageTitle title="Sign out" />
      <Dialog
        title="Sign out of Teal?"
        description="Your profile and listening history stay with your account. You can sign in again whenever you like."
        onClose={goBack}
      >
        <ButtonRow>
          <Button
            label="Sign out"
            onPress={() => {
              logOut();
              router.replace("/");
            }}
          />
          <Button label="Cancel" variant="secondary" onPress={goBack} />
        </ButtonRow>
      </Dialog>
    </>
  );
}
