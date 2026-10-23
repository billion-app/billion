import type { AddressFormProps } from "~/components/AddressForm";
import type { AppTranslate } from "~/i18n/app-strings";
import { AddressForm } from "~/components/AddressForm";
import { useAppTranslation } from "~/hooks/useAppTranslation";
import {
  deviceLocationMessage,
  useDeviceAddress,
} from "~/hooks/useDeviceAddress";

export type { AddressPurpose } from "~/components/AddressForm";

type LocationError = ReturnType<typeof useDeviceAddress>["error"];

function newsLocationMessage(
  error: LocationError,
  t: AppTranslate,
): string | null {
  switch (error) {
    case "denied":
      return t("address.news.denied");
    case "unavailable":
      return t("address.news.unavailable");
    case "failed":
      return t("address.news.failed");
    case "address-unavailable":
      return t("address.news.noStreetAddress");
    default:
      return null;
  }
}

export function AddressAutocomplete(props: AddressFormProps) {
  const device = useDeviceAddress();
  const { t } = useAppTranslation();
  const purpose = props.purpose ?? (props.inline ? "news" : "voting");
  const errorMessage =
    purpose === "news"
      ? newsLocationMessage(device.error, t)
      : deviceLocationMessage(device.error, t);
  return <AddressForm {...props} location={{ ...device, errorMessage }} />;
}
