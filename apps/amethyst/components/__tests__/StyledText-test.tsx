import * as React from "react";
import { render, screen } from "@testing-library/react-native";

import { Text } from "../ui/text";

describe("Text Component", () => {
  it("displays text content to users", () => {
    render(<Text>Hello World</Text>);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  it("renders with custom className", () => {
    render(<Text className="text-lg font-bold">Styled text</Text>);
    const element = screen.getByText("Styled text");
    expect(element).toBeTruthy();
    expect(element.props.className).toContain("text-lg");
    expect(element.props.className).toContain("font-bold");
  });

  it("renders empty text component", () => {
    const { root } = render(<Text />);
    expect(root).toBeTruthy();
  });

  it("renders multiple children correctly", () => {
    render(
      <Text>
        First part <Text>nested</Text> last part
      </Text>,
    );
    expect(screen.getByText("nested")).toBeTruthy();
  });
});
