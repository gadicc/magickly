import { Node } from "json-rich-text/lib/esm/index.js";
import React from "react";
import DocContext from "../../src/doc/context.js";
import {
  FootnoteReferenceFrame,
  FootnotesFrame,
  GradeFrame,
  ImageFrame,
  ListFrame,
  ListItemFrame,
  NoteFrame,
  SummaryFrame,
  TaskBody,
  TaskFrame,
  TitleFrame,
  TodoFrame,
} from "./ritualBlocks/Frames";
import { roleAliases } from "./ritualBlocks/roles";
import { planRitualFootnotes } from "./ritualFootnotes";

class Title extends Node {
  render(key) {
    return (
      <TitleFrame key={key} anchor={this.block.text.replace(/ /g, "_")}>
        {(this.children && this.renderChildren()) ||
          this.block.value ||
          this.block.text}
      </TitleFrame>
    );
  }
}

class Grade extends Node {
  render(key) {
    return <GradeFrame key={key} grade={this.block.grade} />;
  }
}

class Todo extends Node {
  //type: "todo";

  render(key) {
    return <TodoFrame key={key}>{this.renderChildren()}</TodoFrame>;
  }
}

class B extends Node {
  render(key) {
    return <b key={key}>{this.renderChildren()}</b>;
  }
}

class I extends Node {
  render(key) {
    return <i key={key}>{this.renderChildren()}</i>;
  }
}

class Img extends Node {
  render(key) {
    const style = this.block.style ? JSON.parse(this.block.style) : {};
    if (!style.width && !this.block.style) style.width = "100%";

    return (
      <ImageFrame
        key={key}
        width={this.block.width}
        height={this.block.height}
        style={style}
        src={this.block.src}
        alt={this.block.alt}
      />
    );
  }
}

class Br extends Node {
  render(key) {
    return <br key={key} />;
  }
}

class ul extends Node {
  render(key) {
    return (
      <ListFrame key={key} ordered={false}>
        {this.renderChildren()}
      </ListFrame>
    );
  }
}

class ol extends Node {
  render(key) {
    return (
      <ListFrame key={key} ordered>
        {this.renderChildren()}
      </ListFrame>
    );
  }
}

class li extends Node {
  render(key) {
    return <ListItemFrame key={key}>{this.renderChildren()}</ListItemFrame>;
  }
}

class hr extends Node {
  render(key) {
    return <hr />;
  }
}

class Var extends Node {
  render(key) {
    // biome-ignore lint/correctness/useHookAtTopLevel: JRT invokes render as its React component
    const context = React.useContext(DocContext);
    const variable = context.vars[this.block.name];
    return (
      <span key={key}>
        {variable ? variable.value : `NO SUCH VARIABLE "${this.block.name}"`}
      </span>
    );
  }
}

class DeclareVar extends Node {
  render(key) {
    return null;
  }
}

class Note extends Node {
  render(key) {
    return <NoteFrame key={key}>{this.renderChildren()}</NoteFrame>;
  }
}

class Summary extends Node {
  render(key) {
    return (
      <SummaryFrame key={key} title={this.block.summary}>
        {this.renderChildren()}
      </SummaryFrame>
    );
  }
}

class Task extends Node {
  //type: "todo";

  render(key) {
    const block = this.block;
    // biome-ignore lint/correctness/useHookAtTopLevel: JRT invokes render as its React component
    const context = React.useContext(DocContext);
    const vars = context.vars;
    const roles = context.roles;
    // console.log({ myRole: vars.myRole.value });

    /*
      let roles;
      if (typeof this.block.role === "string") roles = [block.role];
      else if (Array.isArray(block.role)) roles = block.role;
      else if (typeof block.role === "object") {
        // TODO
        roles = ["all (except: " + block.role["all-except"] + ")"];
      } else
        throw new Error("Unknown role type: " + JSON.stringify(block.role));
      */
    const myRole = (function () {
      const role = vars.myRole?.value; // "hierophant"
      return roleAliases[role] || role;
    })();

    let forMe,
      role = block.role;

    if (role === myRole || role === "all") forMe = true;
    else if (role === "all-officers")
      forMe = !["candidate", "member"].includes(myRole);
    else if (role.startsWith("all-except-"))
      forMe = !role.substr(11).split(",").includes(myRole);
    else if (role.startsWith("all-officers-except-"))
      forMe =
        !["candidate", "member"].includes(myRole) &&
        !role.substr(20).split(",").includes(myRole);
    else if (role.match(",")) forMe = role.split(",").includes(myRole);

    /*
    // we show this in the builtin editor now anyway
    if (!["all-officers", "all"].includes(role)) {
      const roles = role
        // all-except-XXX, all-officers-except-XXX
        .replace(/^all.*-except-/, "")
        .split(",");
      for (const role of roles)
        if (!context.roles[role])
          console.log(
            "%c Invalid role: " + role,
            "background: #ffa",
            this.block
          );
    }
    */

    const samePreviousRole = this.prev() && this.prev().block.role === role;

    // biome-ignore lint/correctness/useHookAtTopLevel: JRT invokes render as its React component
    const ref = React.useRef();
    // biome-ignore lint/correctness/useHookAtTopLevel: JRT invokes render as its React component
    React.useEffect(() => {
      this.block.ref = ref;
      this.block.forMe = forMe;
      return () => {
        delete this.block.ref;
        delete this.block.forMe;
      };
    });

    function renderChildren(node, children) {
      return children ? children.map((child, i) => child.render(i)) : null;
    }

    // Keep the task's collection outside its speech/action presentation.
    const body = (
      <>
        {block.say && (
          <TaskBody action={false}>
            {renderChildren(
              this,
              this.children.filter((node) => node.block.type !== "footnotes"),
            )}
          </TaskBody>
        )}
        {block.do && (
          <TaskBody action>
            {renderChildren(
              this,
              this.children.filter((node) => node.block.type !== "footnotes"),
            )}
          </TaskBody>
        )}
      </>
    );
    const notes = footnotePlan(this).collections.get(this);
    const footnotes = this.children.find((node) => node instanceof Footnotes);
    const footer = footnotes ? (
      footnotes.render()
    ) : notes?.length ? (
      <FootnotesFrame>
        {notes.map((note, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: legacy JRT has no persisted node IDs; preserve its ordered child keys
          <li key={i}>{note.renderChildren()}</li>
        ))}
      </FootnotesFrame>
    ) : null;
    return (
      <div key={key} ref={ref}>
        <TaskFrame
          role={role}
          roles={roles}
          audience={forMe ? "self" : "other"}
          samePreviousRole={samePreviousRole}
          page={key}
          footer={footer}
        >
          {body}
        </TaskFrame>
      </div>
    );
  }
}

function footnotePlan(node) {
  return node.footnotePlan;
}

class Footnote extends Node {
  render(key) {
    return (
      <FootnoteReferenceFrame
        key={key}
        number={footnotePlan(this).references.get(this)?.number ?? 1}
      />
    );
  }
}

class Footnotes extends Node {
  render(key) {
    return (
      <FootnotesFrame key={key}>
        {(footnotePlan(this).collections.get(this) ?? []).map((note, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: legacy JRT has no persisted node IDs; preserve its ordered child keys
          <li key={i}>{note.renderChildren()}</li>
        ))}
      </FootnotesFrame>
    );
  }
}

class Stylesheet extends Node {
  render(key) {
    return <link key={key} rel="stylesheet" href={this.block.href} />;
  }
}

class A extends Node {
  render(key) {
    const valid = this.block.href && this.block.href.startsWith("http");
    return valid ? (
      <a key={key} href={this.block.href} target="_blank">
        {this.renderChildren()}
      </a>
    ) : (
      <span
        key={key}
        style={{ textDecoration: "red underline" }}
        title={"Blocked href to " + this.block.href}
      >
        {this.renderChildren()}
      </span>
    );
  }
}

class Span extends Node {
  render(key) {
    const { type: _type, children: _children, ..._attrs } = this.block;
    const attrs = _attrs || {};
    // console.log("span", attrs);

    return (
      <span
        key={key}
        {...attrs}
        style={
          attrs.style &&
          JSON.parse(
            // https://stackoverflow.com/a/34763398/1839099
            attrs.style.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": '),
          )
        }
      >
        {this.renderChildren()}
      </span>
    );
  }
}

export const blocks = {
  a: A,
  b: B,
  i: I,
  br: Br,
  img: Img,
  ul,
  ol,
  li,
  hr,
  span: Span,
  stylesheet: Stylesheet,

  note: Note,
  task: Task,
  title: Title,
  todo: Todo,

  var: Var,
  declareVar: DeclareVar,
  summary: Summary,
  footnote: Footnote,
  footnotes: Footnotes,

  grade: Grade,
};
Node.registerBlocks(blocks);

// NB: If we don't export "Node", React fast refresh won't pickup Component
// changes.
/** Plan footnotes before React rendering while preserving the reader's collection order. */
export function Render({ doc, onChange }) {
  const root = Node.getBlockNode(doc);
  root.footnotePlan = planRitualFootnotes(
    root,
    (node) => node.block.type,
    (node) => node.children ?? [],
    (node) => {
      const { type, say, do: action } = node.block;
      return type === "task"
        ? !!(say || action)
        : ![
            "declareVar",
            "img",
            "br",
            "grade",
            "var",
            "stylesheet",
            "hr",
            "cursor",
            "text",
          ].includes(type);
    },
  );
  // JRT caches child instances without refreshing their parent pointers on
  // immutable rerenders. Give every node this render's plan directly.
  const attach = (node) => {
    node.footnotePlan = root.footnotePlan;
    for (const child of node.children ?? []) attach(child);
  };
  attach(root);
  if (onChange) root.onChange = onChange;
  return root.render();
}
export { Node };
