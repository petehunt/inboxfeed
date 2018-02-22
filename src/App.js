import { Base64 } from "js-base64";
import { Row, Col, Block } from "jsxstyle";
import * as Gmail from "./Gmail";
import invariant from "invariant";
import moment from "moment-shortformat";
import React, { Component } from "react";
import VisibilitySensor from "react-visibility-sensor";

import FaThumbTack from "react-icons/lib/fa/thumb-tack";
import FaCheck from "react-icons/lib/fa/check";

import "./App.css";

function getHeader(message, name) {
  name = name.toLowerCase();

  for (let header of message.payload.headers) {
    if (header.name.toLowerCase() === name) {
      return header.value;
    }
  }

  return null;
}

function getTextPlainParts(accum, parts) {
  if (!parts) {
    return;
  }

  for (let part of parts) {
    if (part.mimeType === "multipart/alternative") {
      getTextPlainParts(accum, part.parts);
    } else if (part.mimeType === "text/plain") {
      accum.push(part);
    }
  }
}

function threadHasLabel(labelId, thread) {
  for (let message of thread.messages) {
    if (message.labelIds.indexOf(labelId) > -1) {
      return true;
    }
  }

  return false;
}

class Email extends Component {
  constructor() {
    super();
    this.state = {
      read: false,
      localPin: null
    };
  }

  handleVisibilityChange(isVisible) {
    if (isVisible) {
      this.props.gapi.client.gmail.users.threads
        .modify({
          userId: "me",
          id: this.props.thread.id,
          addLabelIds: [this.props.labelIds["Pmail-Read"]]
        })
        .then(() => {});
      this.setState({ read: true });
    }
  }

  handleToggle() {
    // TODO: error handling
    if (this.isPinned()) {
      this.props.gapi.client.gmail.users.threads
        .modify({
          userId: "me",
          id: this.props.thread.id,
          removeLabelIds: [this.props.labelIds["Pmail-Pinned"]]
        })
        .then(() => {});
      this.setState({ localPin: false });
    } else if (this.state.read) {
      this.props.gapi.client.gmail.users.threads
        .modify({
          userId: "me",
          id: this.props.thread.id,
          addLabelIds: [this.props.labelIds["Pmail-Pinned"]]
        })
        .then(() => {});
      this.setState({ localPin: true });
    }
  }

  isPinned() {
    if (this.state.localPin !== null) {
      return this.state.localPin;
    }
    return threadHasLabel(
      this.props.labelIds["Pmail-Pinned"],
      this.props.thread
    );
  }

  render() {
    const { thread } = this.props;
    const message = thread.messages[thread.messages.length - 1];
    const subject = getHeader(message, "Subject");
    const from = getHeader(message, "From");
    const to = Array.from(
      new Set(
        [getHeader(message, "To")].concat(
          (getHeader(message, "Cc") || "").split(",").map(cc => cc.trim())
        )
      )
    )
      .filter(addr => addr && addr.trim().length > 0)
      .join(", ");

    const date = moment(parseInt(message.internalDate, 10)).short();
    const plainParts = [];
    getTextPlainParts(plainParts, message.payload.parts);

    const body = plainParts
      .map(part => {
        return Base64.decode(
          part.body.data.replace(/-/g, "+").replace(/_/g, "/")
        );
      })
      .join(" ");

    const pinned = this.isPinned();

    return (
      <Col
        border="1px solid rgba(0,0,0,0.2)"
        margin={10}
        mediaQueries={{ sm: "(max-width: 640px)" }}
        smMargin={0}
        fontSize="14px"
        background="white"
      >
        <Col
          zIndex={1}
          position="sticky"
          top={0}
          background="white"
          paddingBottom={10}
          borderBottom="1px solid rgba(0,0,0,0.2)"
        >
          <Row padding={10} borderBottom="1px solid rgba(0,0,0,0.2)">
            <Block color="gray" flexGrow={0} flexShrink={0} marginRight={5}>
              {this.props.index + 1} / {this.props.total}
            </Block>
            <Block
              fontWeight="bold"
              flexGrow={1}
              marginRight={5}
              whiteSpace="nowrap"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {subject}
            </Block>
            <Block
              flex={0}
              whiteSpace="nowrap"
              color="gray"
              component="a"
              props={{
                href: "https://mail.google.com/mail/u/0/#inbox/" + message.id,
                target: "_blank"
              }}
            >
              {thread.messages.length} messages
            </Block>
          </Row>
          <Row padding={10} paddingBottom={0}>
            <Block
              width={32}
              height={32}
              background="rgba(0,0,0,0.1)"
              border="1px solid rgba(0,0,0,0.15)"
              flexGrow={0}
              flexShrink={0}
              marginRight={10}
            />

            <Col flexGrow={1}>
              <Row>
                <Block marginRight={5} fontWeight="bold">
                  {from}
                </Block>
                <Block flexGrow={1} />
                <Block marginRight={5}>{date}</Block>
              </Row>
              <Row color="gray">to {to}</Row>
            </Col>
          </Row>
        </Col>
        <Block
          padding={10}
          whiteSpace="pre-wrap"
          overflow="hidden"
          wordWrap="break-word"
        >
          {body}
        </Block>
        <VisibilitySensor onChange={this.handleVisibilityChange.bind(this)} />
        <Row
          borderTop="1px solid rgba(0,0,0,0.2)"
          position="sticky"
          bottom={0}
          background="white"
        >
          <Block padding={10}>Unsubscribe &middot; Block &middot; Snooze</Block>
          <Block flex={1} />
          <Block
            padding={10}
            props={{ role: "button", onClick: this.handleToggle.bind(this) }}
            cursor="pointer"
          >
            {this.state.read && !pinned && <FaCheck />}
            {pinned && <FaThumbTack />}
          </Block>
        </Row>
      </Col>
    );
  }
}

const LABEL_NAMES = ["Pmail-Read", "Pmail-Pinned"];

class Inbox extends Component {
  constructor() {
    super();
    this.state = {
      threads: null,
      labels: null
    };
  }

  componentDidMount() {
    this.props.gapi.client.gmail.users.threads
      .list({
        userId: "me",
        q: "is:unread in:inbox -label:Pmail-Read OR label:Pmail-Pinned"
      })
      .then(response => {
        const { threads } = response.result;
        return Promise.all(
          threads.map(thread => {
            return this.props.gapi.client.gmail.users.threads
              .get({
                userId: "me",
                id: thread.id
              })
              .then(response => response.result);
          })
        );
      })
      .then(threads => this.setState({ threads }));

    this.fetchLabels(true);
  }

  fetchLabels(createLabels) {
    this.props.gapi.client.gmail.users.labels
      .list({ userId: "me" })
      .then(response => {
        const { labels } = response.result;
        let seenPmailLabels = 0;

        for (let label of labels) {
          if (LABEL_NAMES.indexOf(label.name) > -1) {
            seenPmailLabels++;
          }
        }

        if (seenPmailLabels < LABEL_NAMES.length) {
          // create the labels
          invariant(createLabels, "createLabels false");
          return Promise.all(
            LABEL_NAMES.map(name =>
              this.props.gapi.client.gmail.users.labels.create({
                userId: "me",
                name
              })
            )
          ).then(() => this.fetchLabels(false));
        } else {
          this.setState({ labels });
        }
      });
  }

  render() {
    if (!this.state.threads || !this.state.labels) {
      return null;
    }

    const labelIds = {};
    for (let label of this.state.labels) {
      if (LABEL_NAMES.indexOf(label.name) > -1) {
        labelIds[label.name] = label.id;
      }
    }

    // reshuffle threads so that previously pinned items are at the end.
    let nonpinned = [];
    let pinned = [];

    for (let thread of this.state.threads) {
      if (threadHasLabel(labelIds["Pmail-Pinned"], thread)) {
        pinned.push(thread);
      } else {
        nonpinned.push(thread);
      }
    }

    return (
      <Col margin={20} mediaQueries={{ sm: "(max-width: 640px)" }} smMargin={0}>
        {nonpinned
          .concat(pinned)
          .map((t, i) => (
            <Email
              index={i}
              total={nonpinned.length + pinned.length}
              thread={t}
              key={i}
              labelIds={labelIds}
              gapi={this.props.gapi}
            />
          ))}
      </Col>
    );
  }
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      isSignedIn: null
    };
  }

  componentDidMount() {
    Gmail.emitter.on("signInStatus", isSignedIn => {
      this.setState({ isSignedIn });
    });

    Gmail.install(
      "466180145285-1sesk8hjfsd5vn82343a2j48r3du0shs.apps.googleusercontent.com"
    );
  }

  handleSignIn() {
    Gmail.gapi.auth2.getAuthInstance().signIn();
  }

  render() {
    if (this.state.isSignedIn === null) {
      // waiting for gapi
      return null;
    }

    if (!this.state.isSignedIn) {
      return (
        <Col margin={20}>
          <button onClick={this.handleSignIn.bind(this)}>Sign in</button>
        </Col>
      );
    }

    return <Inbox gapi={Gmail.gapi} />;
  }
}

export default App;
