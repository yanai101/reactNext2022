import logo from "./logo.svg";
import "./App.css";
import { proxy, useSnapshot } from "./storeProxy";

const state = proxy({ count: 0, text: "hello" });

const Counter = () => {
  const snap = useSnapshot(state);
  const inc = () => ++state.count;
  return (
    <span>
      {snap.count} <button onClick={inc}>+1</button>
    </span>
  );
};

const TextField = () => {
  const snap = useSnapshot(state);
  return (
    <span>
      <input
        value={snap.text}
        onChange={(e) => (state.text = e.target.value)}
      />
    </span>
  );
};

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Hello Simplified Valtio!</p>
        <p>
          Counter: <Counter />
        </p>
        <p>
          TextField: <TextField />
        </p>
        <p>
          <a
            className="App-link"
            href="https://daishi.gumroad.com/l/learn-valtio"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn Simplified Valtio
          </a>
        </p>
      </header>
    </div>
  );
}

export default App;
