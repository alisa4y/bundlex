import { Greet } from "./components.jsx"
export function App(props) {
  return (
    <main>
      <Greet {...props} />
    </main>
  )
}
