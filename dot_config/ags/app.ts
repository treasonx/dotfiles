import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"

app.start({
  css: style,
  requestHandler(request: string, respond: (response: string) => void) {
    switch (request) {
      default:
        respond(`unknown command: ${request}`)
    }
  },
  main() {
    app.get_monitors().map(Bar)
  },
})
