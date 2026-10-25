import common from "./common";
import home from "./home";
import library from "./library";
import navigation from "./navigation";
import onboarding from "./onboarding";
import revision from "./revision";
import settings from "./settings";
import wordDetails from "./wordDetails";
import wordProgress from "./wordProgress";

const pl = {
  ...common,
  ...wordDetails,
  ...wordProgress,
  ...navigation,
  ...home,
  ...onboarding,
  ...settings,
  ...library,
  ...revision,
};

export default pl;
