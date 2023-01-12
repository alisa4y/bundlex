import { Greet } from "./components"
export function App(props) {
  return (
    <main>
      <Greet {...props} />
    </main>
  )
}
