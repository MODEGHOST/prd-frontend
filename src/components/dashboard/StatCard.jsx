import { Children, Fragment, isValidElement } from "react";
import { Card, Col, Row, Statistic } from "antd";

export function StatCard({ title, value, hint, icon, color }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <Statistic title={title} value={value} prefix={icon} valueStyle={{ color, fontWeight: 600 }} />
      {hint ? <p className="mt-2 mb-0 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

export function StatGrid({ children }) {
  const flatten = (nodes) => Children.toArray(nodes).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? flatten(child.props.children)
      : [child]);
  const items = flatten(children);
  return (
    <Row gutter={[16, 16]}>
      {items.map((child, index) => (
        <Col xs={24} sm={12} xl={6} key={index}>
          {child}
        </Col>
      ))}
    </Row>
  );
}
