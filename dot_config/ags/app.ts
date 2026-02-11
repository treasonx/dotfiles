import app from "ags/gtk4/app"
import Bar from "./widget/Bar"

app.start({
  main() {
    app.get_monitors().map(Bar)
  },
})
